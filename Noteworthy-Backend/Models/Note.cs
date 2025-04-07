using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Noteworthy_Backend.Models
{
    //Model for Note Objects to interact with the associated MySQL Table
    public class Note
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public string Title { get; set; }

        public string Tags { get; set; } //Comma-delimited tags

        public string FilePath { get; set; }

        [ForeignKey("User")]
        public int UserId { get; set; }

        public double OrderValue { get; set; }
    }
}
