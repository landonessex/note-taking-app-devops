namespace Noteworthy_Backend.Models.DTOs
{
    //DTO used when a Note is Updated/Saved
    public class NoteUpdateDTO
    {
        public string Title { get; set; }
        public string Tags { get; set; }
        public string Content { get; set; }
    }
}
