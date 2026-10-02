using Hangfire;
using Hangfire.PostgreSql;
using HabitCheckin.Application.Abstractions;
using HabitCheckin.Application.Services;
using HabitCheckin.Infrastructure.Auth;
using HabitCheckin.Infrastructure.Jobs;
using HabitCheckin.Infrastructure.Media;
using HabitCheckin.Infrastructure.Persistence;
using HabitCheckin.Infrastructure.Realtime;
using HabitCheckin.Infrastructure.Time;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using System.Text;

namespace HabitCheckin.Infrastructure;

public static class DependencyInjection
{
    /// <summary>
    /// Trùng lặp ý định: IANA id "Asia/Ho_Chi_Minh" không có trên Windows;
    /// Hangfire cần Windows tz id. Thử IANA trước, lỗi thì dùng "SE Asia Standard Time".
    /// </summary>
    public static TimeZoneInfo? VietnamZone()
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById("Asia/Ho_Chi_Minh"); }
        catch { return TimeZoneInfo.FindSystemTimeZoneById("SE Asia Standard Time"); }
    }

    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        // EF Core — chuẩn hoá connection string (Render trả dạng postgresql:// URI)
        var conn = PostgresConnectionString.Normalize(configuration.GetConnectionString("Default"));
        services.AddDbContext<AppDbContext>(opt => opt.UseNpgsql(conn));
        services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<AppDbContext>());

        // Thời gian
        services.AddSingleton<IClock, SystemClock>();

        // User hiện tại từ JWT
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUser, CurrentUser>();

        // Auth
        services.Configure<GoogleOptions>(configuration.GetSection(GoogleOptions.SectionName));
        services.AddSingleton<IGoogleTokenValidator, GoogleTokenValidator>();
        services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.SectionName));
        services.AddSingleton<IJwtTokenService, JwtTokenService>();

        services.AddAuthentication(opts =>
            {
                opts.DefaultScheme = JwtBearerDefaults.AuthenticationScheme;
                opts.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
            })
            .AddJwtBearer(opts =>
            {
                var jwt = configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>() ?? new JwtOptions();
                opts.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidIssuer = jwt.Issuer,
                    ValidAudience = jwt.Audience,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Secret)),
                    ValidateIssuer = true,
                    ValidateAudience = true,
                    ValidateIssuerSigningKey = true,
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.FromSeconds(10)
                };
                // Hub dùng query string access_token
                opts.Events = new JwtBearerEvents
                {
                    OnMessageReceived = ctx =>
                    {
                        var token = ctx.Request.Query["access_token"];
                        if (!string.IsNullOrEmpty(token) && string.IsNullOrEmpty(ctx.Token))
                            ctx.Token = token;
                        return Task.CompletedTask;
                    }
                };
            });
        services.AddAuthorization();

        // Media
        services.Configure<CloudinaryOptions>(configuration.GetSection(CloudinaryOptions.SectionName));
        services.AddSingleton<IMediaStorage, CloudinaryMediaStorage>();

        // Realtime
        services.AddSingleton<IPresenceTracker, PresenceTracker>();
        services.AddSingleton<IRealtimeNotifier, SignalRNotifier>();
        services.AddSignalR();

        // Hangfire (storage Postgres)
        services.AddHangfire(cfg => cfg.UsePostgreSqlStorage(conn!));
        services.AddHangfireServer(opts =>
        {
            opts.WorkerCount = 2;
            opts.Queues = new[] { "default" };
        });
        services.AddScoped<IJobStatusProvider, HangfireJobStatusProvider>();

        // Job recurring (cron theo giờ VN) — đăng ở Program.cs sau khi có IRecurringJobManager.
        return services;
    }
}
