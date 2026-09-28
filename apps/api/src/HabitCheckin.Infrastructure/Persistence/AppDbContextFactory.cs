using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace HabitCheckin.Infrastructure.Persistence;

/// <summary>Factory cho dotnet-ef khi chạy migration từ CLI (không cần boot app).</summary>
public sealed class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=localhost;Port=5434;Database=habit;Username=habit;Password=habit")
            .Options;
        return new AppDbContext(options);
    }
}
