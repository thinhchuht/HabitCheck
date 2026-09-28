using System.Net;
using System.Net.Http.Json;
using FluentAssertions;

namespace HabitCheckin.Api.IntegrationTests;

public sealed class HealthTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private record HealthResponse(string Status, string Time);

    [Fact]
    public async Task Health_ReturnsOk()
    {
        if (!factory.DockerAvailable)
        {
            Console.WriteLine("SKIP: Docker không khả dụng");
            return;
        }

        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/api/health");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<HealthResponse>();
        body.Should().NotBeNull();
        body!.Status.Should().Be("ok");
        body.Time.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task SwaggerJson_IsServed()
    {
        if (!factory.DockerAvailable)
        {
            Console.WriteLine("SKIP: Docker không khả dụng");
            return;
        }

        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/swagger/v1/swagger.json");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await response.Content.ReadAsStringAsync();
        json.Should().Contain("\"openapi\"").And.Contain("Habit Check-in API");
    }
}
