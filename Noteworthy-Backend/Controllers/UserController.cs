using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Noteworthy_Backend.Data;
using Noteworthy_Backend.Models;
using Noteworthy_Backend.Models.DTOs;
using System.Net.Mail;
using System.Net;

namespace Noteworthy_Backend.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UserController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public UserController(ApplicationDbContext context)
        {
            _context = context;
        }

        //GET: api/User
        //Get a list of all user objects, used for testing, will be moved to an admin controller on next Release
        [HttpGet]
        public async Task<ActionResult<IEnumerable<User>>> GetUsers()
        {
            return await _context.Users.ToListAsync();
        }

        //GET: api/User/{id}
        //Get the user object that has the specified ID
        [HttpGet("{id}")]
        public async Task<ActionResult<User>> GetUser(int id)
        {
            var user = await _context.Users.FindAsync(id);

            if (user == null)
            {
                return NotFound();
            }

            return user;
        }

        //POST: api/User/Register
        //Create a new user Object and store it in the Users Table
        [HttpPost("Register")]
        public async Task<ActionResult<User>> RegisterUser([FromBody] User user)
        {
            // Check if username already exists
            if (await _context.Users.AnyAsync(u => u.Username == user.Username))
            {
                return BadRequest(new { message = "Username has already been taken" });
            }

            // Check if email already exists
            if (await _context.Users.AnyAsync(u => u.Email == user.Email))
            {
                return BadRequest(new { message = "Email is already in use" });
            }


            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetUser), new { id = user.UserId }, user);
        }


        // POST: api/User/Login
        //Validates that the username and password match what is in the DB, and returns an OK with the user Object
        [HttpPost("Login")]
        public async Task<ActionResult<LoginResponseDTO>> LoginUser([FromBody] LoginDTO loginDto)
        {
            // Find the user by username and password
            var existingUser = await _context.Users
                                             .FirstOrDefaultAsync(u => u.Username == loginDto.Username &&
                                                                       u.Password == loginDto.Password);
            if (existingUser == null)
            {
                return Unauthorized(new { message = "Invalid username or password" });
            }

            // Retrieve all notes belonging to the user
            var notes = await _context.Notes
                                      .Where(n => n.UserId == existingUser.UserId)
                                      .ToListAsync();

            var noteDTOs = new List<NoteDTO>();

            // Loop through each note to read its JSON file content and map to NoteDTO
            foreach (var note in notes)
            {
                string content = null;
                if (System.IO.File.Exists(note.FilePath))
                {
                    var jsonContent = await System.IO.File.ReadAllTextAsync(note.FilePath);
                    using var jsonDoc = System.Text.Json.JsonDocument.Parse(jsonContent);
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

            var response = new LoginResponseDTO
            {
                UserId = existingUser.UserId,
                Username = existingUser.Username,
                Email = existingUser.Email,
                Notes = noteDTOs
            };

            return Ok(response);
        }




        // PUT: api/User/UpdateUsername
        // Handles PUT request to update an existing user's username
        [HttpPut("UpdateUsername/{id}")]
        public async Task<IActionResult> UpdateUsername(int id, [FromBody] UpdateUsernameDTO dto)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            // Check if the username already exists
            if (await _context.Users.AnyAsync(u => u.Username == dto.NewUsername && u.UserId != id))
            {
                return BadRequest(new { message = "Username is already taken" });
            }

            user.Username = dto.NewUsername;
            await _context.SaveChangesAsync();
            return Ok(new { message = "Username updated successfully" });
        }

        // PUT: api/User/UpdatePassword
        // Handles PUT request to update an existing user's password
        [HttpPut("UpdatePassword/{id}")]
        public async Task<IActionResult> UpdatePassword(int id, [FromBody] UpdatePasswordDTO dto)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            user.Password = dto.NewPassword; // TODO: Hash this if security is needed
            await _context.SaveChangesAsync();
            return Ok(new { message = "Password updated successfully" });
        }

        // PUT: api/User/UpdateEmail
        // Handles PUT request to update an existing user's email
        [HttpPut("UpdateEmail/{id}")]
        public async Task<IActionResult> UpdateEmail(int id, [FromBody] UpdateEmailDTO dto)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            // Check if the email already exists
            if (await _context.Users.AnyAsync(u => u.Email == dto.NewEmail && u.UserId != id))
            {
                return BadRequest(new { message = "Email is already in use" });
            }

            user.Email = dto.NewEmail;
            await _context.SaveChangesAsync();
            return Ok(new { message = "Email updated successfully" });
        }




        // POST: api/User/forgot-password
        // Handles POST request to initiate a password reset by generating a reset token
        [HttpPost("forgot-password")]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordDTO model)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == model.Email);
            if (user == null)
            {
                return BadRequest(new { message = "User with this email does not exist." });
            }
            // Generate reset token
            var token = Guid.NewGuid().ToString();
            user.ResetToken = token;
            user.ResetTokenExpiry = DateTime.UtcNow.AddMinutes(10);
            await _context.SaveChangesAsync();
            // Send email
            var resetLink = $"{token}";
            var emailSent = await SendResetEmail(user.Email, resetLink);
            if (!emailSent)
            {
                return StatusCode(500, new { message = "Error sending email." });
            }
            return Ok(new { message = "Reset link sent successfully." });
        }


        //Send Token to Verified User/Email
        private async Task<bool> SendResetEmail(string toEmail, string resetLink)
        {
            try
            {
                var fromAddress = new MailAddress("servicesnoteworthy@gmail.com", "Noteworthy Support");
                var toAddress = new MailAddress(toEmail);
                const string fromPassword = "levtrjfriwxxjnfs";
                const string subject = "Reset Your Password";
                string body = $"Use the following to reset your password: {resetLink}";
                var smtp = new SmtpClient
                {
                    Host = "smtp.gmail.com",
                    Port = 587,
                    EnableSsl = true,
                    DeliveryMethod = SmtpDeliveryMethod.Network,
                    UseDefaultCredentials = false,
                    Credentials = new NetworkCredential(fromAddress.Address, fromPassword)
                };
                using (var message = new MailMessage(fromAddress, toAddress)
                {
                    Subject = subject,
                    Body = body,
                    IsBodyHtml = false
                })
                {
                    await smtp.SendMailAsync(message);
                }
                return true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Email send failed: {ex.Message}");
                return false;
            }
        }


        // POST: api/User/reset-password
        // Handles POST request to reset user password using a valid reset token
        [HttpPost("reset-password")]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordDTO model)
        {
            // Check if the new password and confirmation match
            if (model.NewPassword != model.ConfirmPassword)
            {
                return BadRequest(new { message = "Passwords do not match." });
            }

            // Validate password strength
            if (!IsValidPassword(model.NewPassword))
            {
                return BadRequest(new { message = "Password must be at least 8 characters long and contain at least one uppercase letter and one special character." });
            }

            var user = await _context.Users.FirstOrDefaultAsync(u => u.ResetToken == model.Token);
            if (user == null || user.ResetTokenExpiry < DateTime.UtcNow)
            {
                return BadRequest(new { message = "Invalid or expired token." });
            }

            // Hash the new password (if needed)
            user.Password = model.NewPassword; // Use hashing if required
            user.ResetToken = null; // Clear the reset token
            user.ResetTokenExpiry = null;

            await _context.SaveChangesAsync();
            return Ok(new { message = "Password has been successfully reset." });
        }

        // Helper method to validate password complexity
        private bool IsValidPassword(string password)
        {
            return password.Length >= 8 &&
                   password.Any(char.IsUpper) &&
                   password.Any(ch => !char.IsLetterOrDigit(ch)); // Ensures at least one special character
        }


        // POST: api/User/VerifyUser
        // Handles POST request to verify a user based on username and email
        [HttpPost("VerifyUser")]
        public async Task<IActionResult> VerifyUser([FromBody] VerifyUserDTO model)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Username == model.Username && u.Email == model.Email);
            if (user == null)
            {
                return BadRequest(new { message = "User not found" });
            }
            return Ok(new { message = "Verified" });
        }


    }
}