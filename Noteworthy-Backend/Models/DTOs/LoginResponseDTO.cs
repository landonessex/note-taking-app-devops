namespace Noteworthy_Backend.Models.DTOs
{
    //DTO used to create a response to a succesful login attempt
    public class LoginResponseDTO
    {
        public int UserId { get; set; }
        public string Username { get; set; }
        public string Email { get; set; }
        public IEnumerable<NoteDTO> Notes { get; set; }
    }
}
