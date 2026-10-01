using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Serialization;
using HabitCheckin.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using ProblemDetails = Microsoft.AspNetCore.Mvc.ProblemDetails;

namespace HabitCheckin.Api.Middleware;

/// <summary>
/// Chặn mọi request đã xác thực của user bị ban: 403 + ProblemDetails
/// "Tài khoản của bạn đã bị chặn". Frontend (client.ts) nhận 403 + detail chứa "chặn"
/// → xoá phiên và chuyển về /login.
/// Bỏ qua /api/auth/* — refresh của user ban được chặn ngay trong RefreshTokenHandler.
/// </summary>
public sealed class BannedUserMiddleware(RequestDelegate next, IServiceScopeFactory scopeFactory)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path.Value ?? string.Empty;
        var user = context.User;
        // "sub" (khi MapInboundClaims=false) hoặc ClaimTypes.NameIdentifier (mapping mặc định)
        var uidRaw = user.FindFirstValue("sub") ?? user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (user.Identity?.IsAuthenticated == true
            && !path.StartsWith("/api/auth", StringComparison.OrdinalIgnoreCase)
            && Guid.TryParse(uidRaw, out var uid))
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var banned = await db.Users.AsNoTracking()
                .AnyAsync(u => u.Id == uid && u.IsBanned);
            if (banned)
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                context.Response.ContentType = "application/problem+json; charset=utf-8";
                var problem = new ProblemDetails
                {
                    Status = StatusCodes.Status403Forbidden,
                    Title = "Tài khoản bị chặn",
                    Detail = "Tài khoản của bạn đã bị chặn. Vui lòng liên hệ quản trị viên.",
                    Type = "https://habit-checkin.local/errors/banned"
                };
                await context.Response.WriteAsync(JsonSerializer.Serialize(problem, new JsonSerializerOptions
                {
                    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
                }));
                return;
            }
        }

        await next(context);
    }
}
