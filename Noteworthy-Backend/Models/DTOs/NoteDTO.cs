namespace Noteworthy_Backend.Models.DTOs
{
    //Base DTO used for interacting with notes
    public class NoteDTO
    {
        public Guid Id { get; set; }
        public string? Title { get; set; }
        public string? Tags { get; set; }
        public string? Content { get; set; }
        public double? OrderValue { get; set; }

    }
}
