export const NotesService = {
    getNote: async (noteId) => {
      console.log("Mock getNote called with ID:", noteId);
      return {
        title: "",
        content: "",
        tags: "",
      };
    },
    
    updateNote: async (noteId, noteData) => {
      console.log("Mock updateNote called with ID:", noteId, "and data:", noteData);
      return { success: true };
    }
  };
