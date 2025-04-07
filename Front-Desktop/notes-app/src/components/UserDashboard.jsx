import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { motion, Reorder } from "framer-motion";
import * as signalR from "@microsoft/signalr";
import UserNavbar from "./UserNavbar";
// This component is for user dashboard for logged-in user
const UserDashboard = () => {
  const navigate = useNavigate();
  const [userID, setUserID] = useState("");
  const [notes, setNotes] = useState([]);
  //Consts for searching
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInTitle, setSearchInTitle] = useState(false);
  const [searchInTags, setSearchInTags] = useState(false);
  const [searchInContent, setSearchInContent] = useState(false);
  //Consts for deleting
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [selectedNotes, setSelectedNotes] = useState([]);
  //Const to track dragging
  const [isDragging, setIsDragging] = useState(false);
  //Consts for Tags and Tag Filtering
  const [tags, setTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState(null);
  const [tagFilter, setTagFilter] = useState([]);
  const [connection, setConnection] = useState(null);

  //Retrieve userId from local storage and navigate if missing
  useEffect(() => {
    const storedUserId = localStorage.getItem("userId");
    if (storedUserId) {
      setUserID(storedUserId);
    } else {
      navigate("/");
    }
  }, [navigate]);

  // Setup SignalR connection for order updates
  useEffect(() => {
    if (!userID) return;
    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl("https://localhost:7272/notehub", { withCredentials: true })
      .withAutomaticReconnect()
      .build();

    setConnection(newConnection);

    newConnection
      .start()
      .then(() => {
        console.log("SignalR connected");
        newConnection
          .invoke("JoinUserGroup", userID)
          .catch((err) => console.error("Error joining user group", err));
      })
      .catch((err) => console.error("SignalR connection error", err));

    newConnection.on("ReceiveOrderUpdate", (orderPayload) => {
      setNotes((prevNotes) => {
        const updatedNotes = prevNotes.map((note) => {
          const updated = orderPayload.find((o) => o.id === note.id);
          return updated ? { ...note, OrderValue: updated.orderValue } : note;
        });
        return updatedNotes.sort((a, b) => a.OrderValue - b.OrderValue);
      });
    });

// Cleanup SignalR connection when component unmounts
return () => {
  if (newConnection && newConnection.state === signalR.HubConnectionState.Connected) {
    newConnection.invoke("LeaveUserGroup", userID).then(() => {
      newConnection.stop();
    });
  }
};
}, [userID]);

  //Fetch notes for the logged-in user
  useEffect(() => {
    const fetchNotes = async () => {
      if (!userID) return;
      try {
        const userId = parseInt(userID, 10);
        const response = await fetch(
          `https://localhost:7272/api/Notes/user/${userId}`
        );
        if (!response.ok) {
          console.error(
            "Fetch failed with status:",
            response.status,
            response.statusText
          );
          return;
        }
        const data = await response.json();
        // Ensure notes are sorted by orderValue ascending
        const sortedNotes = data.sort((a, b) => a.orderValue - b.orderValue);
        setNotes(sortedNotes);
      } catch (error) {
        console.error("Error fetching notes:", error);
      }
    };

    fetchNotes();
    fetchTags();
  }, [userID]);

  //Fetch tags for the specific user
  const fetchTags = async () => {
    if (!userID) return;
    try {
      const userId = parseInt(userID, 10);
      const response = await fetch(
        `https://localhost:7272/api/Notes/user/${userId}/tags`
      );
      if (!response.ok) {
        console.error(
          "Fetch failed with status:",
          response.status,
          response.statusText
        );
        return;
      }
      const tagsData = await response.json();
      console.log("Fetched tags:", tagsData);
      setTags(tagsData);
    } catch (error) {
      console.error("Error fetching tags:", error);
    }
  };

  //Update tagFilter when notes or selectedTag changes
  useEffect(() => {
    if (selectedTag) {
      setTagFilter(
        notes.filter((note) =>
          note.tags
            ?.split(",")
            .map((t) => t.trim().toLowerCase())
            .includes(selectedTag.toLowerCase())
        )
      );
    } else {
      setTagFilter(notes);
    }
  }, [notes, selectedTag]);

  //Tag selection
  const handleTagClick = (tag) => {
    if (tag === "ALL_NOTES") {
      setSelectedTag(null);
      setTagFilter(notes); // Show all notes if "All Notes" is selected
    } else {
      setSelectedTag(tag);
      setTagFilter(
        notes.filter((note) => {
          if (!note.tags) return false;
          return note.tags
            .split(",")
            .map((t) => t.trim().toLowerCase())
            .includes(tag.toLowerCase());
        })
      );
    }
  };

  //Use tag filter as the base set, then apply search query filtering
  const baseNotes = selectedTag ? tagFilter : notes;
  const filteredNotes = baseNotes.filter((note) => {
    if (!searchQuery) return true;
    const lowerQuery = searchQuery.toLowerCase();
    const matchTitle = note.title.toLowerCase().includes(lowerQuery);
    const matchTags = note.tags
      ? note.tags
          .split(",")
          .some((tag) => tag.trim().toLowerCase().includes(lowerQuery))
      : false;
    const matchContent = note.content.toLowerCase().includes(lowerQuery);

    //If no checkboxes are selected, search in all fields.
    if (!searchInTitle && !searchInTags && !searchInContent) {
      return matchTitle || matchTags || matchContent;
    } else {
      let result = false;
      if (searchInTitle) result = result || matchTitle;
      if (searchInTags) result = result || matchTags;
      if (searchInContent) result = result || matchContent;
      return result;
    }
  });

  //Toggle selection for a note for use in batch activities, currently only for deletion
  const toggleSelect = (noteId) => {
    setSelectedNotes((prevSelected) =>
      prevSelected.includes(noteId)
        ? prevSelected.filter((id) => id !== noteId)
        : [...prevSelected, noteId]
    );
  };

  // Handles note deletion and updates UI
  const handleDelete = async (noteId, e) => {
    e.stopPropagation(); // Prevent navigation to edit page
    try {
      const response = await fetch(
        `https://localhost:7272/api/Notes/${noteId}`,
        {
          method: "DELETE",
        }
      );
      if (response.ok) {
        setSelectedNotes(notes.filter((note) => note.id !== noteId)); //delete the tag which was included in the deleted note section
        setNotes(notes.filter((note) => note.id !== noteId)); // update notes section
      }
      fetchTags(); // update tags section once the note was deleted
    } catch (error) {
      console.error("Error deleting note:", error);
    }
    setActiveDropdown(null);
  };

  //Delete all selected notes
  const handleDeleteSelected = async () => {
    const idsToDelete = [...selectedNotes];
    for (const noteId of idsToDelete) {
      try {
        const response = await fetch(
          `https://localhost:7272/api/Notes/${noteId}`,
          {
            method: "DELETE",
          }
        );
        if (!response.ok) {
          console.error("Error deleting note with id", noteId);
        }
      } catch (error) {
        console.error("Error deleting note:", error);
      }
    }
    //Update notes and clear selection
    setNotes((prevNotes) =>
      prevNotes.filter((note) => !idsToDelete.includes(note.id))
    );
    setSelectedNotes([]);
    fetchTags(); // update tags section once notes were deleted
  };

  //Update note order on the server using the new OrderValue
  const updateNoteOrderOnServer = async (orderedNotes) => {
    const payload = orderedNotes.map((note) => ({
      id: note.id,
      orderValue: note.OrderValue,
    }));

    try {
      const response = await fetch("https://localhost:7272/api/Notes/order", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        console.error("Error updating note order on server");
      } else {
        if (
          connection &&
          connection.state === signalR.HubConnectionState.Connected
        ) {
          try {
            await connection.invoke("UpdateNoteOrder", payload, userID);
          } catch (err) {
            console.error("Error broadcasting order update via SignalR", err);
          }
        }
      }
    } catch (error) {
      console.error("Error updating note order on server:", error);
    }
  };

  //Create a new note and navigate to the edit page
  const handleCreateNote = async () => {
    try {
      const newNote = {
        title: "New Note",
        tags: "",
        userId: userID,
        content: "",
      };

      const response = await fetch("https://localhost:7272/api/Notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newNote),
      });

      if (response.ok) {
        const createdNote = await response.json();
        const newOrderValue =
          notes.length > 0
            ? Math.max(...notes.map((n) => n.OrderValue)) + 1
            : 1;
        createdNote.OrderValue = newOrderValue;
        navigate(`/edit-note/${createdNote.id}`);
      } else {
        console.error("Failed to create note");
      }
    } catch (error) {
      console.error("Error creating note:", error);
    }
  };

  //Toggle the dropdown for note options
  const toggleDropdown = (noteId, e) => {
    e.stopPropagation();
    setActiveDropdown(activeDropdown === noteId ? null : noteId);
  };

  //Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setActiveDropdown(null);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-indigo-500 to-blue-600 text-white">
      <UserNavbar />

      {/* Search Bar */}
      <div className="flex flex-col items-center mt-20 px-4">
        <div className="relative">
          <input
            type="text"
            placeholder="🔍 Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64 p-2 pr-8 text-sm rounded-md border border-white/30 bg-white/20 text-white placeholder-gray-300 outline-none focus:ring-2 focus:ring-white"
          />
          {searchQuery && (
            <button
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white"
              onClick={() => setSearchQuery("")}
            >
              ❌
            </button>
          )}
        </div>
        {searchQuery && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex mt-2 space-x-4"
          >
            <label className="inline-flex items-center">
              <input
                type="checkbox"
                checked={searchInTitle}
                onChange={(e) => setSearchInTitle(e.target.checked)}
                className="form-checkbox"
              />
              <span className="ml-2">Title</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="checkbox"
                checked={searchInTags}
                onChange={(e) => setSearchInTags(e.target.checked)}
                className="form-checkbox"
              />
              <span className="ml-2">Tags</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="checkbox"
                checked={searchInContent}
                onChange={(e) => setSearchInContent(e.target.checked)}
                className="form-checkbox"
              />
              <span className="ml-2">Note Content</span>
            </label>
          </motion.div>
        )}
      </div>
      {/* Tag Filter Selection */}
      <div className="flex flex-wrap gap-2 mt-4 justify-center">
        <button
          className={`px-3 py-1 text-sm rounded-md border border-white/30 bg-white/20 text-white hover:bg-white/40 ${
            selectedTag === null ? "bg-white/40" : ""
          }`}
          onClick={() => handleTagClick("ALL_NOTES")}
        >
          All Notes
        </button>
        {tags.map((tag, index) => (
          <button
            key={index}
            className={`px-3 py-1 text-sm rounded-md border border-white/30 bg-white/20 text-white hover:bg-white/40 ${
              selectedTag === tag ? "bg-white/40" : ""
            }`}
            onClick={() => handleTagClick(tag)}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Main container */}
      <div className="container mx-auto px-4 py-8 mt-10">
        {/* Action Button, New Note or Delete Notes if Checkboxes are selected */}
        <div className="flex justify-end mb-4">
          {selectedNotes.length > 0 ? (
            <button
              onClick={handleDeleteSelected}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded shadow"
            >
              Delete Notes
            </button>
          ) : (
            <button
              onClick={handleCreateNote}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow"
            >
              + New Note
            </button>
          )}
        </div>

        {/* Table header row */}
        <div className="hidden md:flex font-semibold px-4 py-2 bg-white/10 border-b border-white/20 rounded-t-lg">
          {/* Empty header cell, for checkbox column */}
          <div className="w-8"></div>
          <div className="flex-1">Name</div>
          <div className="w-1/5">Tags</div>
          <div className="w-1/5 text-right">Actions</div>
        </div>

        {/* Container for draggable rows */}
        <Reorder.Group
          axis="y"
          values={filteredNotes}
          onReorder={(newOrder) => {
            const updatedNotes = newOrder.map((note, index) => ({
              ...note,
              OrderValue: index + 1,
            }));
            setNotes(updatedNotes);
            updateNoteOrderOnServer(updatedNotes);
          }}
          className="flex flex-col bg-white/10 rounded-b-lg border border-white/20"
        >
          {filteredNotes.map((note) => (
            <Reorder.Item
              key={note.id}
              value={note}
              onDragStart={() => setIsDragging(true)}
              onDragEnd={() => setIsDragging(false)}
              whileDrag={{ scale: 1.0 }}
            >
              <motion.div
                className="flex flex-col md:flex-row items-start md:items-center px-4 py-3 border-b border-white/20 hover:bg-white/20 cursor-pointer relative"
                onClick={() => {
                  if (!isDragging) {
                    navigate(`/edit-note/${note.id}`);
                  }
                }}
              >
                {/* Checkbox column */}
                <div className="mr-4">
                  <input
                    type="checkbox"
                    checked={selectedNotes.includes(note.id)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggleSelect(note.id)}
                    className="form-checkbox"
                  />
                </div>
                {/* Title column */}
                <div className="flex-1 mb-2 md:mb-0">{note.title}</div>
                {/* Tags column */}
                <div className="w-full md:w-1/5 mb-2 md:mb-0">
                  {note.tags && note.tags.trim() !== "" ? (
                    <div className="flex flex-wrap gap-1">
                      {note.tags.split(",").map((tag, index) => {
                        const trimmedTag = tag.trim();
                        return (
                          <button
                            key={index}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSearchQuery(trimmedTag);
                            }}
                            className="inline-block bg-blue-700 text-white px-2 py-1 rounded hover:bg-blue-400 focus:outline-none"
                          >
                            {trimmedTag}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="italic">No tags</span>
                  )}
                </div>
                {/* Actions column */}
                <div className="w-full md:w-1/5 flex items-center justify-end space-x-2">
                  <button
                    onClick={(e) => toggleDropdown(note.id, e)}
                    className="px-3 py-1 hover:bg-white/10 rounded-full"
                  >
                    ⋮
                  </button>
                  {activeDropdown === note.id && (
                    <div className="absolute right-4 top-12 md:top-auto md:right-2 mt-1 w-48 rounded-md shadow-lg bg-white/20 backdrop-blur-lg ring-1 ring-black ring-opacity-5 z-50">
                      <div className="py-1" role="menu">
                        <button
                          onClick={(e) => handleDelete(note.id, e)}
                          className="block w-full px-4 py-2 text-left text-white hover:bg-white/10"
                          role="menuitem"
                        >
                          🗑️ Delete Note
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      </div>
    </div>
  );
};

export default UserDashboard;
