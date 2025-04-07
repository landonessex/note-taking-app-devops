import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import * as signalR from "@microsoft/signalr";

const SharedNote = () => {
  // Get info from URL
  const { noteId } = useParams();
  const [searchParams] = useSearchParams();
  const isEditMode = searchParams.get("access") === "edit";
  const [accessRevoked, setAccessRevoked] = useState(false);

  // Note data
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Saving state
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [lastSaved, setLastSaved] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Real-time connection
  const [connection, setConnection] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const saveTimer = useRef(null);

  // Tag management
  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState("");

  // Keep a reference to the latest note state for async operations
  const latestNoteRef = useRef(null);

  // Check for revoked access
  useEffect(() => {
    // Check localStorage for revoked status
    const isRevoked = localStorage.getItem(`revoked-note-${noteId}`) === 'true';
    setAccessRevoked(isRevoked);
    
    if (isRevoked) {
      setLoading(false);
      return;
    }

    // Original note loading code
    const fetchNote = async () => {
      try {
        const response = await fetch(
          `https://localhost:7272/api/Notes/${noteId}`
        );

        if (!response.ok) {
          throw new Error("Couldn't load the note");
        }

        const data = await response.json();
        setNote(data);
        latestNoteRef.current = data;
        setLoading(false);
        setIsReady(true);
      } catch (err) {
        console.error("Error loading note:", err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchNote();
  }, [noteId]);

  // Update the ref whenever note changes
  useEffect(() => {
    latestNoteRef.current = note;
  }, [note]);

  // Parse tags from string to array when note changes
  useEffect(() => {
    if (note && note.tags) {
      setTags(note.tags.split(",").filter((tag) => tag.trim()));
    } else {
      setTags([]);
    }
  }, [note?.tags]);

  // Set up real-time connection
  useEffect(() => {
    if (connection || accessRevoked) return;

    // Create connection
    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl("https://localhost:7272/notehub")
      .withAutomaticReconnect()
      .build();

    setConnection(newConnection);

    // Connect to the server
    const connect = async () => {
      try {
        await newConnection.start();
        console.log("Connected to real-time updates");

        // Join note's group
        await newConnection.invoke("JoinNoteGroup", noteId);
      } catch (err) {
        console.error("Connection error:", err);
        setTimeout(connect, 5000);
      }
    };

    connect();

    // Listen for updates
    newConnection.on("ReceiveNoteUpdate", (updatedNote) => {
      if (
        updatedNote.id.toString() === noteId &&
        !updatedNote.isFromCurrentUser
      ) {
        // Update note with the changes
        setNote((prevNote) => {
          if (!prevNote) return null;
          return {
            ...prevNote,
            title: updatedNote.title,
            content: updatedNote.content,
            tags: updatedNote.tags,
          };
        });

        if (!updatedNote.isKeystroke) {
          setHasChanges(false);
        }
      }
    });

    // Clean up when leaving the page
    return () => {
      if (newConnection.state === "Connected") {
        newConnection
          .invoke("LeaveNoteGroup", noteId)
          .then(() => newConnection.stop())
          .catch((err) => console.error("Disconnect error:", err));
      }
    };
  }, [noteId, connection, accessRevoked]);

  // Update the note when user types
  const handleChange = (changes) => {
    // Apply the changes to note
    setNote((current) => {
      const updated = { ...current, ...changes };
      return updated;
    });
    setHasChanges(true);

    // Only send updates if in edit mode
    if (isEditMode && isReady) {
      // Send updates to other users
      setTimeout(() => {
        if (connection?.state === "Connected") {
          // Get the most current version
          const currentNote = latestNoteRef.current;

          // Create the update
          const update = {
            id: noteId,
            title: currentNote.title,
            content: currentNote.content,
            tags: currentNote.tags,
            isKeystroke: true,
            isFromCurrentUser: true,
          };

          Object.keys(changes).forEach((key) => {
            update[key] = changes[key];
          });

          // Send to other users
          connection
            .invoke("UpdateNoteContent", noteId, update)
            .catch((err) => console.error("Error sending update:", err));
        }
      }, 100);

      // Schedule auto-save
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }

      saveTimer.current = setTimeout(saveNote, 2000);
    }
  };

  // Add a new tag
  const handleAddTag = (e) => {
    e.preventDefault();
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      const updatedTags = [...tags, newTag.trim()];
      setTags(updatedTags);
      setNewTag("");

      // Update the note with new tags
      const tagString = updatedTags.join(",");
      setNote((current) => ({
        ...current,
        tags: tagString,
      }));

      setHasChanges(true);

      // Schedule auto-save
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
      saveTimer.current = setTimeout(saveNote, 2000);

      // Send real-time update
      if (connection?.state === "Connected") {
        connection
          .invoke("UpdateNoteContent", noteId, {
            id: noteId,
            title: note.title,
            content: note.content,
            tags: tagString,
            isKeystroke: true,
            isFromCurrentUser: true,
          })
          .catch((err) => console.error("Error sending update:", err));
      }
    }
  };

  // Delete a tag
  const handleDeleteTag = (tagToDelete) => {
    const updatedTags = tags.filter((tag) => tag !== tagToDelete);
    setTags(updatedTags);

    // Update the note with new tags
    const tagString = updatedTags.join(",");
    setNote((current) => ({
      ...current,
      tags: tagString,
    }));

    setHasChanges(true);

    // Schedule auto-save
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }
    saveTimer.current = setTimeout(saveNote, 2000);

    // Send real-time update
    if (connection?.state === "Connected") {
      connection
        .invoke("UpdateNoteContent", noteId, {
          id: noteId,
          title: note.title,
          content: note.content,
          tags: tagString,
          isKeystroke: true,
          isFromCurrentUser: true,
        })
        .catch((err) => console.error("Error sending update:", err));
    }
  };

  // Save the note to the database
  const saveNote = async () => {
    if (isSaving || !isEditMode) return;

    setIsSaving(true);

    try {
      // Get the most current version of the note
      const currentNote = latestNoteRef.current;

      // Data to save
      const saveData = {
        title: currentNote.title,
        content: currentNote.content,
        tags: currentNote.tags,
      };

      // Send save request
      const response = await fetch(
        `https://localhost:7272/api/Notes/${noteId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(saveData),
        }
      );

      if (response.ok) {
        // Update save info
        const now = new Date();
        setLastSaved(now);
        setSaveMessage("Saved");
        setHasChanges(false);

        if (connection?.state === "Connected") {
          connection
            .invoke("UpdateNoteContent", noteId, {
              ...saveData,
              id: noteId,
              isKeystroke: false,
              isFromCurrentUser: true, 
            })
            .catch((err) => console.error("Error notifying of save:", err));
        }

        // Clear message after 3 seconds
        setTimeout(() => setSaveMessage(""), 3000);
      } else {
        setSaveMessage("Save failed");
        setTimeout(() => setSaveMessage(""), 3000);
      }
    } catch (error) {
      console.error("Error saving:", error);
      setSaveMessage("Error saving");
      setTimeout(() => setSaveMessage(""), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  // Clean up timer
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
  }, []);

  // Format time
  const getLastSavedText = () => {
    if (!lastSaved) return "";
    return `Last saved at ${lastSaved.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  };

  // Render access denied screen if access has been revoked
  if (accessRevoked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 shadow-lg max-w-md">
          <div className="text-center">
            <div className="text-red-300 text-5xl mb-4">🚫</div>
            <h2 className="text-white text-2xl font-bold mb-4">Access Denied</h2>
            <p className="text-white/80 mb-6">
              The owner of this note has revoked access to this shared link.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show error screen
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 shadow-lg">
          <p className="text-white text-lg">Error: {error}</p>
        </div>
      </div>
    );
  }

  // Show note not found screen
  if (!note) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 shadow-lg">
          <p className="text-white text-lg">Note not found</p>
        </div>
      </div>
    );
  }

  // Main note view
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-blue-600">
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 shadow-lg mt-16">
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-white text-xl">
              {isEditMode ? "Edit" : "View"} Shared Note
            </h2>

            {/* Save status */}
            {isEditMode && (
              <div className="text-white/70 text-sm flex items-center gap-2">
                {saveMessage && (
                  <span
                    className={
                      saveMessage.includes("Error") ||
                      saveMessage.includes("failed")
                        ? "text-red-300"
                        : "text-green-300"
                    }
                  >
                    {saveMessage}
                  </span>
                )}
                {lastSaved && <span>{getLastSavedText()}</span>}

                <button
                  onClick={saveNote}
                  disabled={isSaving || !hasChanges}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg shadow transition disabled:opacity-50 ml-2"
                >
                  Save
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-6">
            {/* Note content */}
            <div className="flex-1 space-y-4">
              {/* Title */}
              <input
                type="text"
                value={note.title || ""}
                onChange={
                  isEditMode
                    ? (e) => handleChange({ title: e.target.value })
                    : undefined
                }
                className="w-full p-2 rounded bg-white/20 text-white placeholder-white/70"
                placeholder="Title"
                readOnly={!isEditMode}
              />

              {/* Content */}
              <textarea
                value={note.content || ""}
                onChange={
                  isEditMode
                    ? (e) => handleChange({ content: e.target.value })
                    : undefined
                }
                className="w-full p-2 rounded bg-white/20 text-white placeholder-white/70 h-[calc(100vh-300px)]"
                placeholder="Note content..."
                readOnly={!isEditMode}
              />
            </div>

            {/* Tags */}
            <div className="w-64">
              <div className="bg-white/20 rounded-lg p-4">
                <h3 className="text-white font-semibold mb-2">Tags</h3>

                {/* Tag editing */}
                {isEditMode && (
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
                )}

                {/* Tags list */}
                <div className="space-y-2">
                  {tags.length > 0 ? (
                    tags.map((tag, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-white/10 p-2 rounded-lg hover:bg-white/20"
                      >
                        <span className="text-white text-sm">{tag}</span>
                        {isEditMode && (
                          <button
                            onClick={() => handleDeleteTag(tag)}
                            className="text-white/60 hover:text-white/90 text-xs"
                          >
                            ❌
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-white/50 text-sm">No tags</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SharedNote;
