namespace Noteworthy_Backend.Models.DTOs
{
    //DTO used to handle Login Attempts, for release 1, passwords are unencrypted, this will be resolved before public release when we move to cloud deployment (Release 2.0)
    public class LoginDTO
    {
        public required string Username { get; set; }
        public required string Password { get; set; }
    }
}
