using Microsoft.AspNetCore.SignalR;
using Noteworthy_Backend.Models.DTOs;

namespace Noteworthy_Backend.Hubs
{
    // This SignalR hub is used to broadcast note updates to all clients connected to the same note or dashboard
    public class NoteHub : Hub
    {
        public async Task JoinNoteGroup(string noteId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, noteId);
        }

        public async Task LeaveNoteGroup(string noteId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, noteId);
        }

        public async Task UpdateNoteContent(string noteId, dynamic noteData)
        {
            await Clients.Group(noteId).SendAsync("ReceiveNoteUpdate", (object)noteData);
        }

        public async Task JoinUserGroup(string userId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user_{userId}");
        }

        public async Task LeaveUserGroup(string userId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"user_{userId}");
        }

        public async Task UpdateNoteOrder(dynamic orderData, string userId)
        {
            await Clients.Group($"user_{userId}").SendAsync("ReceiveOrderUpdate", (object)orderData);
        }
    }
}
