import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import * as signalR from "@microsoft/signalr";
import UserNavbar from "./UserNavbar";

const EditNote = () => {
	// Get note ID from URL parameters
	const { noteId } = useParams();
	const navigate = useNavigate();
	const autoSaveTimerRef = useRef(null);
	const latestNoteRef = useRef({ title: '', content: '', tags: '' });

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
				const response = await fetch(
					`https://localhost:7272/api/Notes/${noteId}`
				);
				if (response.ok) {
					const data = await response.json();
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
				}
			} catch (error) {
				console.error("Error fetching note:", error);
				setInitialDataLoaded(true);
			}
		};
		fetchNote();
	}, [noteId]);

	// Setup SignalR connection when component mounts
	useEffect(() => {
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
					setTags(updatedNote.tags ? updatedNote.tags.split(",").filter(tag => tag.trim()) : []);
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
	}, [noteId]);

	// Autosave function that uses latestNoteRef to capture all changes
	const handleAutoSave = async () => {
		if (isSaving) return;
		setIsSaving(true);
		setAutoSavePending(false);
		
		// Gets the most recent note data
		try {
			const currentNote = {
				title: latestNoteRef.current.title,
				content: latestNoteRef.current.content,
				tags: latestNoteRef.current.tags,
			};

			// Send PUT request to update the note
			const response = await fetch(
				`https://localhost:7272/api/Notes/${noteId}`,
				{
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(currentNote),
				}
			);

			if (response.ok) {
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
			} else {
				setSaveMessage("Save failed");
				setTimeout(() => setSaveMessage(""), 3000);
			}
		} catch (error) {
			console.error("Error during autosave:", error);
			setSaveMessage("Error saving");
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
		  };

	// Add new tag to the tags array
	const handleAddTag = (e) => {
		e.preventDefault();
		if (newTag.trim() && !tags.includes(newTag.trim())) {
			setTags([...tags, newTag.trim()]);
			setNewTag("");
			if (initialDataLoaded) {
				setHasUnsavedChanges(true);
				scheduleAutosave();
			}
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

			// Send PUT request to update the note
			const response = await fetch(
				`https://localhost:7272/api/Notes/${noteId}`,
				{
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(currentNote),
				}
			);

			if (response.ok) {
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
			} else {
				setSaveMessage("Save failed");
				setTimeout(() => setSaveMessage(""), 3000);
			}
		} catch (error) {
			console.error("Error saving note:", error);
			setSaveMessage("Error saving");
			setTimeout(() => setSaveMessage(""), 3000);
		} finally {
			setIsSaving(false);
		}
	};

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

					// Fetch API
					fetch(`https://localhost:7272/api/Notes/${noteId}`, {
						method: "PUT",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify(noteData),
					});
				} catch (error) {
					console.error("Error", error);
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
	}, [hasUnsavedChanges, noteId, note, tags]);

	// Format the last saved time
	const getLastSavedText = () => {
		if (!lastSaved) return "";

		return `Last saved at ${lastSaved.toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit",
		})}`;
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
							{saveMessage && (
								<span
									className={`${
										saveMessage.includes("Error") ||
										saveMessage.includes("failed")
											? "text-red-300"
											: saveMessage.includes("Auto-saving")
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
		</div>
	);
};

export default EditNote;
