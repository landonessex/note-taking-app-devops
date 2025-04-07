import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import * as signalR from "@microsoft/signalr";
import UserNavbar from "./UserNavbar";
import { NotesService } from "../services/ApiService";

const EditNote = () => {
  // Get note ID from URL parameters
  const { noteId } = useParams();
  const navigate = useNavigate();
  const autoSaveTimerRef = useRef(null);
  const latestNoteRef = useRef({ title: '', content: '', tags: '' });
  const shareModalRef = useRef(null);
  const shareLinkRef = useRef(null);

  // State management for note content and tags
  const [note, setNote] = useState({
    title: "",
    content: "",
  });
  const [tags, setTags] = useState([]); // Array of tags
  const [newTag, setNewTag] = useState(""); // Input field for new tag
  const [isSaving, setIsSaving] = useState(false); // Loading state for save operation
  const [saveMessage, setSaveMessage] = useState(""); // Message to display after save attempt
  const [lastSaved, setLastSaved] = useState(null); // Timestamp of last save
  const [initialDataLoaded, setInitialDataLoaded] = useState(false); // Track if initial data has loaded
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false); // Track if there are unsaved changes
  const [connection, setConnection] = useState(null); // SignalR connection
  const [autoSavePending, setAutoSavePending] = useState(false); // Track if autosave is pending
  const [isOffline, setIsOffline] = useState(false); // Track if user is offline
  
  // Share functionality states
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);
  const [shareAccess, setShareAccess] = useState("view"); 
  // Add revoke access state
  const [accessRevoked, setAccessRevoked] = useState(false);

  // Monitor online/offline status
  useEffect(() => {
    // Function to update online status
    const handleOnlineStatus = () => {
      setIsOffline(!navigator.onLine);
    };
    
    // Check initial status
    handleOnlineStatus();
    
    // Set up event listeners
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    
    // Clean up event listeners
    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, []);

  // Keeps track of latest changes for autosave to use the most current data
  useEffect(() => {
    latestNoteRef.current = {
      title: note.title,
      content: note.content,
      tags: tags.join(",")
    };
  }, [note, tags]);

  // Fetch note data when component mounts or noteId changes
  useEffect(() => {
    const fetchNote = async () => {
      try {
        // Check if there's offline data to use
        const offlineData = localStorage.getItem(`offline-note-${noteId}`);
        if (isOffline && offlineData) {
          const parsedData = JSON.parse(offlineData);
          setNote({
            title: parsedData.title,
            content: parsedData.content,
          });
          setTags(
            parsedData.tags ? parsedData.tags.split(",").filter((tag) => tag.trim()) : []
          );
          setInitialDataLoaded(true);
          setHasUnsavedChanges(false);
          return;
        }

        const data = await NotesService.getNote(noteId);
        // Set note data and parse tags from comma-separated string
        setNote({
          title: data.title,
          content: data.content,
        });
        setTags(
          data.tags ? data.tags.split(",").filter((tag) => tag.trim()) : []
        );
        setInitialDataLoaded(true); // Mark that initial data has loaded
        setHasUnsavedChanges(false);
        
        // Check if access was previously revoked
        const isRevoked = localStorage.getItem(`revoked-note-${noteId}`) === 'true';
        setAccessRevoked(isRevoked);
      } catch (error) {
        console.error("Error fetching note:", error);
        // Try to load from offline storage if online fetch fails
        const offlineData = localStorage.getItem(`offline-note-${noteId}`);
        if (offlineData) {
          const parsedData = JSON.parse(offlineData);
          setNote({
            title: parsedData.title,
            content: parsedData.content,
          });
          setTags(
            parsedData.tags ? parsedData.tags.split(",").filter((tag) => tag.trim()) : []
          );
          setSaveMessage("Loaded from offline storage");
          setTimeout(() => setSaveMessage(""), 3000);
        }
        setInitialDataLoaded(true);
      }
    };
    fetchNote();
  }, [noteId, isOffline]);

  // Setup SignalR connection when component mounts
  useEffect(() => {
    // Don't attempt connection if offline
    if (isOffline) return;

    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl("https://localhost:7272/notehub", {
        withCredentials: true,
      })
      .withAutomaticReconnect()
      .build();

    setConnection(newConnection);

    const startConnection = async () => {
      try {
        await newConnection.start();
        console.log("SignalR Connected");
        // Only join group after successful connection
        if (newConnection.state === signalR.HubConnectionState.Connected) {
          await newConnection.invoke("JoinNoteGroup", noteId); // Join group for this note
        }
      } catch (err) {
        console.error("SignalR Connection Error: ", err);
        setTimeout(startConnection, 5000);
      }
    };

    startConnection();

    // Handle note update messages from SignalR
    newConnection.on("ReceiveNoteUpdate", (updatedNote) => {
      if (updatedNote.id.toString() === noteId) {
        const isKeystrokeUpdate = updatedNote.isKeystroke === true;

        if (isKeystrokeUpdate || !hasUnsavedChanges) {
          setNote({
            title: updatedNote.title,
            content: updatedNote.content,
          });
          setTags(updatedNote.tags ? updatedNote.tags.split(",").filter((tag) => tag.trim()) : []);
          if (!isKeystrokeUpdate) {
            setHasUnsavedChanges(false);
          }
        }
      }
    });

    // Cleanup SignalR connection when component unmounts
    return () => {
      if (newConnection && newConnection.state === signalR.HubConnectionState.Connected) {
        newConnection.invoke("LeaveNoteGroup", noteId).then(() => {
          newConnection.stop();
        });
      }
    };
  }, [noteId, isOffline]);

  // Close modal when clicking outside of it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (shareModalRef.current && !shareModalRef.current.contains(event.target)) {
        setShowShareModal(false);
        setCopySuccess(false);
      }
    };

    if (showShareModal) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showShareModal]);

  // Autosave function that uses latestNoteRef to capture all changes
  const handleAutoSave = async () => {
    if (isSaving) return;
    
    // Check if offline
    if (isOffline) {
      setSaveMessage("You're offline. Changes saved locally.");
      // Store note in localStorage for later sync
      localStorage.setItem(`offline-note-${noteId}`, JSON.stringify({
        title: latestNoteRef.current.title,
        content: latestNoteRef.current.content,
        tags: latestNoteRef.current.tags
      }));
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      setAutoSavePending(false);
      setTimeout(() => setSaveMessage(""), 3000);
      return;
    }
    
    setIsSaving(true);
    setAutoSavePending(false);

    // Gets the most recent note data
    try {
      const currentNote = {
        title: latestNoteRef.current.title,
        content: latestNoteRef.current.content,
        tags: latestNoteRef.current.tags,
      };

      // Update the note using NotesService
      await NotesService.updateNote(noteId, currentNote);

      // Update last saved time
      const now = new Date();
      setLastSaved(now);
      setSaveMessage("Saved");
      setHasUnsavedChanges(false);

      // Sends the saved note to other users if connected
      if (connection && connection.state === signalR.HubConnectionState.Connected) {
        try {
          await connection.invoke("UpdateNoteContent", noteId, {
            ...currentNote,
            id: noteId,
            isKeystroke: false
          });
        } catch (signalRError) {
          console.error("SignalR send error:", signalRError);
        }
      }

      // Clear success/error messages after 3 seconds
      setTimeout(() => setSaveMessage(""), 3000);
    } catch (error) {
      console.error("Error during autosave:", error);
      setSaveMessage("Error saving");
      
      // Save to localStorage as fallback
      localStorage.setItem(`offline-note-${noteId}`, JSON.stringify({
        title: latestNoteRef.current.title,
        content: latestNoteRef.current.content,
        tags: latestNoteRef.current.tags
      }));
      setSaveMessage("Saved locally due to error");
      
      setTimeout(() => setSaveMessage(""), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  // Resets the timer whenever you type, call function after 3 secs
  const scheduleAutosave = () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    setAutoSavePending(true);

    autoSaveTimerRef.current = setTimeout(() => {
      handleAutoSave();
    }, 3000);
  };

  // Handle note title/content changes
  const handleNoteChange = (updatedNote) => {
    setNote(updatedNote);
    if (initialDataLoaded) {
      setHasUnsavedChanges(true);
      scheduleAutosave();

      // Only try to send realtime updates if online
      if (!isOffline) {
        setTimeout(() => {
          if (connection && connection.state === signalR.HubConnectionState.Connected) {
            const noteToSend = {
              id: noteId,
              title: updatedNote.title,
              content: updatedNote.content,
              tags: tags.join(","),
              isKeystroke: true
            };

            connection.invoke("UpdateNoteContent", noteId, noteToSend)
          }
        }, 10); // 10ms delay
      }
    }
  };

  // add new tags
const handleAddTag = (e) => {
  e.preventDefault();
  const trimmedTag = newTag.trim();
  
  // Check if trimmed tag exists (case-insensitive)
  const tagExists = tags.some(tag => 
    tag.toLowerCase() === trimmedTag.toLowerCase()
  );
  
  // Only add if not empty and not a duplicate
  if (trimmedTag && !tagExists) {
    setTags([...tags, trimmedTag]);
    setNewTag("");
    if (initialDataLoaded) {
      setHasUnsavedChanges(true);
      scheduleAutosave();
    }
  } else if (tagExists) {
    // Show feedback that tag already exists
    setSaveMessage("Tag already exists");
    setTimeout(() => setSaveMessage(""), 2000);
  }
};

  // Remove tag from the tags array
  const handleDeleteTag = (tagToDelete) => {
    setTags(tags.filter((tag) => tag !== tagToDelete));
    if (initialDataLoaded) {
      setHasUnsavedChanges(true);
      scheduleAutosave();
    }
  };

  // Save the note to the database
  const handleSave = async () => {
    // Skip if already saving
    if (isSaving) return;
    
    // Check if offline
    if (isOffline) {
      setSaveMessage("You're offline. Changes saved locally.");
      // Store note in localStorage for later sync
      localStorage.setItem(`offline-note-${noteId}`, JSON.stringify({
        title: note.title,
        content: note.content,
        tags: tags.join(",")
      }));
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      setTimeout(() => setSaveMessage(""), 3000);
      return;
    }

    setIsSaving(true);
    setAutoSavePending(false);

    // Clear any pending autosave timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    try {
      // Prepare the updated note data
      const currentNote = {
        title: note.title,
        content: note.content,
        tags: tags.join(","),
      };

      // Update the note using NotesService
      await NotesService.updateNote(noteId, currentNote);

      // Update last saved time
      const now = new Date();
      setLastSaved(now);
      setSaveMessage("Saved");
      setHasUnsavedChanges(false);

      // Only invoke if connection exists and is in Connected state
      if (connection && connection.state === signalR.HubConnectionState.Connected) {
        try {
          await connection.invoke("UpdateNoteContent", noteId, {
            ...currentNote,
            id: noteId,
            isKeystroke: false
          });
        } catch (signalRError) {
          console.error("SignalR send error:", signalRError);
          // Continue execution even if SignalR fails
        }
      }

      // Clear success/error messages after 3 seconds
      setTimeout(() => setSaveMessage(""), 3000);
    } catch (error) {
      console.error("Error saving note:", error);
      setSaveMessage("Error saving, stored locally");
      
      // Save to localStorage as fallback
      localStorage.setItem(`offline-note-${noteId}`, JSON.stringify({
        title: note.title,
        content: note.content,
        tags: tags.join(",")
      }));
      
      setTimeout(() => setSaveMessage(""), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  // Function to sync offline notes when coming back online
  useEffect(() => {
    if (!isOffline) {
      const offlineData = localStorage.getItem(`offline-note-${noteId}`);
      if (offlineData) {
        const parsedData = JSON.parse(offlineData);
        // Only sync if we were previously offline and now we're online
        const syncOfflineChanges = async () => {
          try {
            await NotesService.updateNote(noteId, parsedData);
            localStorage.removeItem(`offline-note-${noteId}`);
            setSaveMessage("Offline changes synced");
            setTimeout(() => setSaveMessage(""), 3000);
          } catch (error) {
            console.error("Error syncing offline changes:", error);
            setSaveMessage("Failed to sync offline changes");
            setTimeout(() => setSaveMessage(""), 3000);
          }
        };
        syncOfflineChanges();
      }
    }
  }, [isOffline, noteId]);

  // Clear timer
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // Setup beforeunload event to save before page unload
  useEffect(() => {
    // Handle page unload/nav
    const handleBeforeUnload = () => {
      if (hasUnsavedChanges) {
        // Try to save the note before leaving
        try {
          // Create the data to send
          const noteData = {
            title: note.title,
            content: note.content,
            tags: tags.join(","),
          };

          // If offline, save to localStorage
          if (isOffline) {
            localStorage.setItem(`offline-note-${noteId}`, JSON.stringify(noteData));
            return;
          }

          // Use NotesService to update
          NotesService.updateNote(noteId, noteData);
        } catch (error) {
          console.error("Error", error);
          // Save to localStorage as fallback
          localStorage.setItem(`offline-note-${noteId}`, JSON.stringify({
            title: note.title,
            content: note.content,
            tags: tags.join(",")
          }));
        }
      }
    };

    // Add event listener if there are unsaved changes
    if (hasUnsavedChanges) {
      window.addEventListener("beforeunload", handleBeforeUnload);
    } else {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    }

    return () => {
      // Save on React router nav if there are unsaved changes
      if (hasUnsavedChanges) {
        handleBeforeUnload();
      }
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges, noteId, note, tags, isOffline]);

  // Format the last saved time
  const getLastSavedText = () => {
    if (!lastSaved) return "";

    return `Last saved at ${lastSaved.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  };

  // Open share modal and generate link
  const handleShareClick = () => {
    // Save before sharing to ensure most recent version is shared
    if (hasUnsavedChanges || autoSavePending) {
      handleSave();
    }
    
    // Generate share link
    const baseUrl = window.location.origin;
    const generatedLink = `${baseUrl}/shared/${noteId}?access=${shareAccess}`;
    setShareLink(generatedLink);
    
    setShowShareModal(true);
  };

  // Copy link to clipboard
  const handleCopyLink = () => {
    if (shareLinkRef.current) {
      shareLinkRef.current.select();
      document.execCommand('copy');
    } else {
      navigator.clipboard.writeText(shareLink);
    }

    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 3000);
  };

  // Toggle between view and edit access
  const toggleShareAccess = () => {
    const newAccess = shareAccess === "view" ? "edit" : "view";
    setShareAccess(newAccess);
    
    // Update the share link
    const baseUrl = window.location.origin;
    const updatedLink = `${baseUrl}/shared/${noteId}?access=${newAccess}`;
    setShareLink(updatedLink);
  };

  return (
    // Main container with gradient background
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-blue-600">
      <UserNavbar />

      {/* Note editor container */}
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 shadow-lg mt-16">
          {/* Save status indicator */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-white text-xl">Edit Note</h2>
            <div className="text-white/70 text-sm flex items-center gap-2">
              {/* Offline indicator */}
              {isOffline && (
                <div className="bg-yellow-500 text-white px-3 py-1 rounded-full text-sm">
                  Offline Mode
                </div>
              )}
              
              {saveMessage && (
                <span
                  className={`${
                    saveMessage.includes("Error") ||
                    saveMessage.includes("failed")
                      ? "text-red-300"
                      : saveMessage.includes("Auto-saving") || saveMessage.includes("offline")
                      ? "text-yellow-300"
                      : "text-green-300"
                  }`}
                >
                  {saveMessage}
                </span>
              )}
              {lastSaved && <span>{getLastSavedText()}</span>}

              {/* Manual save button - enabled when there are unsaved changes or auto-save is pending */}
              <button
                onClick={handleSave}
                disabled={isSaving || (!hasUnsavedChanges && !autoSavePending)}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg shadow transition duration-300 disabled:opacity-50 ml-2 text-m"
              >
                Save
              </button>

              {/* Share button */}
              <button
                onClick={handleShareClick}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg shadow transition duration-300 flex items-center gap-1 ml-2"
              >
                Share
              </button>
            </div>
          </div>

          <div className="flex gap-6">
            {/* Left side - Note content editor */}
            <div className="flex-1 space-y-4">
              {/* Title input field */}
              <div>
                <input
                  type="text"
                  value={note.title}
                  onChange={(e) =>
                    handleNoteChange({ ...note, title: e.target.value })
                  }
                  className="w-full p-2 rounded bg-white/20 text-white placeholder-white/70"
                  placeholder="Title"
                />
              </div>

              {/* Content textarea */}
              <div>
                <textarea
                  value={note.content}
                  onChange={(e) =>
                    handleNoteChange({ ...note, content: e.target.value })
                  }
                  className="w-full p-2 rounded bg-white/20 text-white placeholder-white/70 h-[calc(100vh-300px)]"
                  placeholder="Note content..."
                />
              </div>
            </div>

            {/* Right side - Tags management */}
            <div className="w-64 space-y-4">
              <div className="bg-white/20 rounded-lg p-4">
                <h3 className="text-white font-semibold mb-2">Tags</h3>

                {/* Tag input form */}
                <form onSubmit={handleAddTag} className="flex mb-4 space-x-1">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    className="flex-1 p-1 rounded-l bg-white/20 text-white placeholder-white/70 text-sm"
                    placeholder="New tag..."
                  />
                  <button
                    type="submit"
                    className="bg-blue-500 text-white px-2 rounded-r hover:bg-blue-600"
                  >
                    ➕
                  </button>
                </form>

                {/* Tags list with delete functionality */}
                <div className="space-y-2">
                  {tags.map((tag, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-white/10 p-2 rounded-lg hover:bg-white/20 group"
                    >
                      <span className="text-white text-sm">{tag}</span>
                      <button
                        onClick={() => handleDeleteTag(tag)}
                        className="text-white/60 hover:text-white/90 text-xs"
                      >
                        ❌
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={() => navigate("/userdashboard")}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg shadow transition duration-300 disabled:opacity-50 ml-2 text-m absolute bottom-7 right-5"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Share Modal with Revoke Access functionality */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div 
            ref={shareModalRef}
            className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-gray-800">Share Note</h3>
              <button 
                onClick={() => setShowShareModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <hr className="border-gray-200 mb-4" />
            
            <p className="text-gray-600 mb-4">
              Anyone with this link can <b>{shareAccess === "view" ? "view" : "edit"}</b> your note
            </p>
            
            {/* Share settings */}
            <div className="flex items-center mb-4">
              <span className="text-gray-700 mr-3">Permission:</span>
              <div className="relative inline-block w-12 mr-2 align-middle select-none">
                <input 
                  type="checkbox" 
                  id="toggle" 
                  className="sr-only"
                  checked={shareAccess === "edit"}
                  onChange={toggleShareAccess}
                />
                <label 
                  htmlFor="toggle" 
                  className={`block overflow-hidden h-6 rounded-full cursor-pointer transition-colors duration-200 ease-in ${
                    shareAccess === "edit" ? "bg-blue-500" : "bg-gray-300"
                  }`}
                >
                  <span 
                    className={`block h-6 w-6 rounded-full bg-white shadow transform transition-transform duration-200 ease-in ${
                      shareAccess === "edit" ? "translate-x-6" : "translate-x-0"
                    }`}
                  ></span>
                </label>
              </div>
              <span className="text-gray-700">{shareAccess === "view" ? "View only" : "Can edit"}</span>
            </div>
            <hr className="border-gray-200 mb-4" />
            
            {/* Link display and copy button */}
            <div className="flex items-center mb-4">
              <div className="relative flex-1">
                <input
                  ref={shareLinkRef}
                  type="text"
                  value={shareLink}
                  readOnly
                  className="w-full p-3 pr-24 border border-gray-300 rounded-lg bg-gray-50 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleCopyLink}
                  className={`absolute right-1 top-1 bottom-1 px-4 py-1 rounded-md ${
                    copySuccess 
                      ? "bg-green-500 hover:bg-green-600" 
                      : "bg-blue-500 hover:bg-blue-600"
                  } text-white transition-colors duration-200`}
                >
                  {copySuccess ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
            
            {/* Revoke access toggle button */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <button
                onClick={function() {
                  if (accessRevoked) {
                    // Un-revoke access
                    localStorage.removeItem(`revoked-note-${noteId}`);
                    setAccessRevoked(false);
                  } else {
                    // Revoke access
                    localStorage.setItem(`revoked-note-${noteId}`, 'true');
                    setAccessRevoked(true);
                  }
                  setTimeout(() => setSaveMessage(""), 3000);
                }}
                className={`w-full py-2 px-4 rounded-md ${
                 accessRevoked 
                    ? "bg-green-500 hover:bg-green-600" 
                    : "bg-red-500 hover:bg-red-600"
                } text-white transition-colors duration-200`}
              >
                {accessRevoked ? "Restore Access" : "Revoke All Access"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditNote;
