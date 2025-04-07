namespace Noteworthy_Backend.Models.DTOs
{
    //Used when a Note is Created for the first time, the OrderValue is defaulted to 0 when not supplied
    public class NoteOrderDto
    {
        public Guid Id { get; set; }
        public double OrderValue { get; set; }
    }

}
