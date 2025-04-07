namespace Noteworthy_Backend.Models.DTOs
{
    //DTO used to Verify users when requesting a password reset
    public class VerifyUserDTO
    {
        public string Username { get; set; }
        public string Email { get; set; }
    }
}
