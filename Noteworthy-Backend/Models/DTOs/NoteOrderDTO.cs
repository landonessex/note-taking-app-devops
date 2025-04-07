namespace Noteworthy_Backend.Models.DTOs
{
    //DTO used when the user rearranges their notes on the dashboard page
    public class NoteOrderDTO
    {
        public required string Title { get; set; }
        public required string Tags { get; set; }
        public required int UserId { get; set; }
        public required string Content { get; set; }
    }
}
