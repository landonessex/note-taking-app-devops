using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Noteworthy_Backend.Models;
using Noteworthy_Backend.Data;
using Noteworthy_Backend.Models.DTOs;
using Microsoft.AspNetCore.SignalR;
using Noteworthy_Backend.Hubs;
using System.Text.Json;

namespace Noteworthy_Backend.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class NotesController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IHubContext<NoteHub> _hubContext;
        private readonly string _notesDirectory = Path.Combine(Directory.GetCurrentDirectory(), "Notes");

        //Create the Base Notes Controller and supply the required contexts for the Application and Hub
        public NotesController(ApplicationDbContext context, IHubContext<NoteHub> hubContext)
        {
            _context = context;
            _hubContext = hubContext;

            //Ensure Notes directory exists
            if (!Directory.Exists(_notesDirectory))
            {
                Directory.CreateDirectory(_notesDirectory);
            }
        }
        //GET: api/Notes/{id}
        //Get the note object for the specific note
        [HttpGet("{id}")]
        public async Task<ActionResult> GetNoteById(Guid id)
        {
            var note = await _context.Notes.FirstOrDefaultAsync(n => n.Id == id);
            if (note == null)
            {
                return NotFound();
            }

            //Verify the note file exists
            if (!System.IO.File.Exists(note.FilePath))
            {
                return NotFound(new { message = "Note file not found" });
            }

            //Read the JSON content from the file
            var jsonContent = await System.IO.File.ReadAllTextAsync(note.FilePath);
            using var jsonDoc = JsonDocument.Parse(jsonContent);
            var content = jsonDoc.RootElement.GetProperty("content").GetString();

            // Return the note details along with its content in JSON format
            return Ok(new
            {
                note.Id,
                note.Title,
                note.Tags,
                note.UserId,
                Content = content
            });
        }
        // GET: api/Notes/user/{userId}
        // Returns all notes for the specified userID
        [HttpGet("user/{userId}")]
        public async Task<ActionResult<IEnumerable<NoteDTO>>> GetNotesByUserId(int userId)
        {
            var notes = await _context.Notes
                .Where(n => n.UserId == userId)
                .ToListAsync();

            var noteDTOs = new List<NoteDTO>();

            foreach (var note in notes)
            {
                string content = null;
                if (System.IO.File.Exists(note.FilePath))
                {
                    // Read the JSON file and extract the "content" property.
                    var jsonContent = await System.IO.File.ReadAllTextAsync(note.FilePath);
                    using var jsonDoc = JsonDocument.Parse(jsonContent);
                    content = jsonDoc.RootElement.GetProperty("content").GetString();
                }

                noteDTOs.Add(new NoteDTO
                {
                    Id = note.Id,
                    Title = note.Title,
                    Tags = note.Tags,
                    OrderValue = note.OrderValue,
                    Content = content
                });
            }

            return Ok(noteDTOs);
        }
        // GET: api/Notes/user/{userId}/tags
        // Returns all tags for the specified user, for the tag filter display at the top of the user dashboard
        [HttpGet("user/{userId}/tags")]
        public async Task<ActionResult<List<string>>> GetUserTags(int userId)
        {
            var notes = await _context.Notes
                .Where(n => n.UserId == userId)
                .ToListAsync(); // Fetch data first

            var tags = notes
                .Where(n => !string.IsNullOrEmpty(n.Tags)) // Ensure no null values
                .SelectMany(n => n.Tags.Split(',', StringSplitOptions.RemoveEmptyEntries)) // Process in memory
                .Select(tag => tag.Trim()) // Remove extra spaces
                .Distinct()
                .ToList();

            return Ok(tags);
        }

        // POST: api/Notes/
        //Creates a new note, streams the content of the note into a localstorage folder (Notes) as a .json object, this is a placeholder for eventual S3 bucket deployment
        [HttpPost]
        public async Task<ActionResult<Note>> CreateNote([FromBody] NoteOrderDTO noteDto)
        {
            // Validate User Exists
            var user = await _context.Users.FindAsync(noteDto.UserId);
            if (user == null)
            {
                return BadRequest(new { message = "User not found" });
            }

            // Create new Note object
            var note = new Note
            {
                Id = Guid.NewGuid(),
                Title = noteDto.Title,
                Tags = noteDto.Tags,
                UserId = noteDto.UserId
            };

            // Save the note content in a JSON file
            string fileName = $"{note.Id}.json";
            string filePath = Path.Combine(_notesDirectory, fileName);

            var jsonObject = new { content = noteDto.Content };
            var jsonString = JsonSerializer.Serialize(jsonObject);
            await System.IO.File.WriteAllTextAsync(filePath, jsonString);

            note.FilePath = filePath;

            _context.Notes.Add(note);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetNoteById), new { id = note.Id }, note);
        }
        // DELETE: api/Notes/{id}
        //Deletes the specified note
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteNote(Guid id)
        {
            var note = await _context.Notes.FirstOrDefaultAsync(n => n.Id == id);
            if (note == null)
            {
                return NotFound();
            }

            // Remove the note file if it exists
            if (System.IO.File.Exists(note.FilePath))
            {
                System.IO.File.Delete(note.FilePath);
            }

            _context.Notes.Remove(note);
            await _context.SaveChangesAsync();

            return NoContent();
        }
        // PUT: api/Notes/{id}
        //Updates the specified note, regenerates the stored file as required.
        [HttpPut("{id}")]
        public async Task<ActionResult<Note>> UpdateNote(Guid id, [FromBody] NoteUpdateDTO updateDto)
        {
            var note = await _context.Notes.FirstOrDefaultAsync(n => n.Id == id);
            if (note == null)
            {
                return NotFound();
            }

            // Update note properties
            note.Title = updateDto.Title;
            note.Tags = updateDto.Tags;

            // Update the file content if provided
            if (updateDto.Content != null)
            {
                var jsonObject = new { content = updateDto.Content };
                var jsonString = JsonSerializer.Serialize(jsonObject);
                await System.IO.File.WriteAllTextAsync(note.FilePath, jsonString);
            }

            _context.Notes.Update(note);
            await _context.SaveChangesAsync();

            // This will broadcast the updated note to all clients connected to the note
            if (_hubContext != null)
            {
                await _hubContext.Clients.Group(id.ToString())
                    .SendAsync("ReceiveNoteUpdate", new
                    {
                        id,
                        title = updateDto.Title,
                        content = updateDto.Content,
                        tags = updateDto.Tags
                    });
            }

            return Ok(note);
        }

        // PUT: api/Notes/order
        //Updates the order of all notes for the user when the user is dragging and reordering notes.
        [HttpPut("order")]
        public async Task<IActionResult> UpdateNoteOrder([FromBody] List<NoteOrderDto> noteOrders)
        {
            foreach (var noteOrder in noteOrders)
            {
                var note = await _context.Notes.FindAsync(noteOrder.Id);
                if (note != null)
                {
                    note.OrderValue = noteOrder.OrderValue;
                }
            }
            await _context.SaveChangesAsync();
            return Ok(new { message = "Order updated successfully" });
        }
    }
}