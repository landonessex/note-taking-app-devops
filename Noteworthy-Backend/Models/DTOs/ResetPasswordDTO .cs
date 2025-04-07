// Handles user password reset requests
public class ResetPasswordDTO
{
    //DTO used when the user is attempting to reset their forgotten password
    public string Token { get; set; }
    public string NewPassword { get; set; }
    public string ConfirmPassword { get; set; }
}
