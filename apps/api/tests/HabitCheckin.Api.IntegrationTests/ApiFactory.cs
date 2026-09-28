using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Testcontainers.PostgreSql;

namespace HabitCheckin.Api.IntegrationTests;

/// <summary>
/// WebApplicationFactory + Postgres thật qua Testcontainers.
/// Nếu Docker không khả dụng trên máy chạy test, các test sẽ được skip thay vì fail.
/// </summary>
public sealed class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private PostgreSqlContainer? _container;

    public bool DockerAvailable { get; private set; } = true;
    public string ConnectionString { get; private set; } = null!;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        if (DockerAvailable)
            builder.UseSetting("ConnectionStrings__Default", ConnectionString);
    }

    public async Task InitializeAsync()
    {
        try
        {
            _container = new PostgreSqlBuilder().Build();
            await _container.StartAsync();
            ConnectionString = _container.GetConnectionString();
        }
        catch (Exception ex)
        {
            DockerAvailable = false;
            _container = null;
            Console.WriteLine($"SKIP integration tests: Docker không khả dụng ({ex.Message})");
        }
    }

    public async Task DisposeAsync()
    {
        if (_container is not null)
            await _container.DisposeAsync();
    }
}
