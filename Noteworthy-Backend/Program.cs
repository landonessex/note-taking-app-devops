using Microsoft.EntityFrameworkCore;
using Noteworthy_Backend.Data;
using Noteworthy_Backend.Hubs;

namespace Noteworthy_Backend
{
    public class Program
    {
        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            //Add services to the container.
            builder.Services.AddControllers();

            //Add Cors
            builder.Services.AddCors(options =>
            {
                options.AddPolicy("ClientPermission", policy =>
                {
                    policy
                        .WithOrigins("http://localhost:3000") // Cant have open CORS policy with SignalR
                        .AllowAnyHeader()
                        .AllowAnyMethod()
                        .AllowCredentials(); // Required for SignalR
                });
            });

            // Add SignalR with CORS handling
            builder.Services.AddSignalR(options =>
            {
                options.EnableDetailedErrors = true;
            });

            //Add MySQL - eventually will be replaced with AWS/Cloud Services
            builder.Services.AddDbContext<ApplicationDbContext>(options =>
                options.UseMySql(builder.Configuration.GetConnectionString("DefaultConnection"),
                new MySqlServerVersion(new Version(8, 0, 34))));

            //Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
            builder.Services.AddEndpointsApiExplorer();
            builder.Services.AddSwaggerGen();

            builder.WebHost.UseUrls("https://localhost:7272");


            var app = builder.Build();


            //Configure the HTTP request pipeline.
            if (app.Environment.IsDevelopment())
            {
                app.UseSwagger();
                app.UseSwaggerUI();
            }

            app.UseHttpsRedirection();

            //Enable CORS Policy
            app.UseCors("ClientPermission");

            app.UseAuthorization();


            app.MapControllers();
            app.MapHub<NoteHub>("/noteHub"); // Map the SignalR Hub to the /noteHub endpoint

            app.Run();
        }
    }
}
