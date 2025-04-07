using System.ComponentModel.DataAnnotations;

namespace Noteworthy_Backend.Models
{
//Model for User Objects to interact with the associated MySQL Table
    public class User
    {
        public int UserId { get; set; }

        [Required(ErrorMessage = "Username is required.")]
        public string Username { get; set; }

        [Required(ErrorMessage = "Password is required.")]
        public string Password { get; set; }

        [Required(ErrorMessage = "Email is required.")]
        public string Email { get; set; }
        public ICollection<Note>? Notes { get; set; }


        public string? ResetToken { get; set; }
        public DateTime? ResetTokenExpiry { get; set; }
    }
}
