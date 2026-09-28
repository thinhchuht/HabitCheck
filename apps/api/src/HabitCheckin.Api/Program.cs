using System.Security.Claims;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using HabitCheckin.Api.Authorization;
using HabitCheckin.Api.Common;
using HabitCheckin.Api.Middleware;
using HabitCheckin.Application;
using HabitCheckin.Infrastructure;
using HabitCheckin.Infrastructure.Jobs;
using HabitCheckin.Infrastructure.Persistence;
using HabitCheckin.Infrastructure.Realtime;
using Hangfire;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{
    // ---------- Services ----------
    builder.Services.AddApplication();
    builder.Services.AddInfrastructure(builder.Configuration);

    // JSON: camelCase + enum string hoa (DEADLINE, PASS...)
    builder.Services.AddControllers().AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter(new UpperEnumNamingPolicy()));
        o.JsonSerializerOptions.Converters.Add(new TimeOnlyShortConverter());
        o.JsonSerializerOptions.Converters.Add(new TimeOnlyShortNullableConverter());
    });

    // CORS (frontend)
    var corsOrigin = builder.Configuration["App:CorsOrigin"] ?? "http://localhost:5173";
    builder.Services.AddCors(o => o.AddDefaultPolicy(p => p
        .WithOrigins(corsOrigin.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials()));

    // Authorization policies: quyền nhóm theo route {groupId}, chủ challenge theo {challengeId}
    builder.Services.AddTransient<IAuthorizationHandler, GroupMemberHandler>();
    builder.Services.AddTransient<IAuthorizationHandler, GroupAdminHandler>();
    builder.Services.AddTransient<IAuthorizationHandler, GroupOwnerHandler>();
    builder.Services.AddTransient<IAuthorizationHandler, ChallengeOwnerHandler>();
    builder.Services.AddAuthorization(o =>
    {
        o.AddPolicy("GroupMember", p => p.AddRequirements(new GroupMemberRequirement()));
        o.AddPolicy("GroupAdmin", p => p.AddRequirements(new GroupAdminRequirement()));
        o.AddPolicy("GroupOwner", p => p.AddRequirements(new GroupOwnerRequirement()));
        o.AddPolicy("ChallengeOwner", p => p.AddRequirements(new ChallengeOwnerRequirement()));
    });

    // Rate limit upload intent: 30/phút/user
    builder.Services.AddRateLimiter(o =>
    {
        o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
        o.AddPolicy("intent-user", ctx =>
        {
            var sub = ctx.User.FindFirstValue("sub")
                ?? ctx.Connection.RemoteIpAddress?.ToString()
                ?? "anon";
            return RateLimitPartition.GetFixedWindowLimiter(sub, _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 30,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            });
        });
    });

    // Swagger
    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddSwaggerGen(o =>
    {
        o.SwaggerDoc("v1", new OpenApiInfo { Title = "Habit Check-in API", Version = "v1" });
        o.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
        {
            Name = "Authorization",
            Type = SecuritySchemeType.Http,
            Scheme = "bearer",
            BearerFormat = "JWT",
            In = ParameterLocation.Header
        });
        o.AddSecurityRequirement(new OpenApiSecurityRequirement
        {
            {
                new OpenApiSecurityScheme
                {
                    Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
                },
                Array.Empty<string>()
            }
        });
    });

    var app = builder.Build();

    // ---------- Migrations (chờ DB sẵn sàng, tối đa ~36s) ----------
    {
        var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Exception? lastError = null;
        for (var attempt = 0; attempt < 12; attempt++)
        {
            try
            {
                await db.Database.MigrateAsync();
                lastError = null;
                break;
            }
            catch (Exception ex)
            {
                lastError = ex;
                Log.Warning("Chưa migrate được (lần {Attempt}): {Error}", attempt + 1, ex.Message);
                await Task.Delay(TimeSpan.FromSeconds(3));
            }
        }
        if (lastError is not null)
            Log.Error(lastError, "Không migrate được database — app vẫn chạy, kiểm tra kết nối DB");
    }

    // ---------- Recurring jobs (cron giờ VN) ----------
    {
        var tz = DependencyInjection.VietnamZone()
            ?? throw new InvalidOperationException("Không tìm thấy timezone Việt Nam trên hệ thống");
        var opts = new RecurringJobOptions { TimeZone = tz };
        using var scope = app.Services.CreateScope();
        var jobs = scope.ServiceProvider.GetRequiredService<IRecurringJobManager>();

        jobs.AddOrUpdate<ChallengeActivationJob>("challenge-activation",
            j => j.RunAsync(CancellationToken.None), "0 0 * * *", opts);
        jobs.AddOrUpdate<DailySettlementJob>("daily-settlement",
            j => j.RunAsync(CancellationToken.None), "5 0 * * *", opts);
        jobs.AddOrUpdate<FinalizeJob>("daily-finalize",
            j => j.RunAsync(CancellationToken.None), "0 12 * * *", opts);
        jobs.AddOrUpdate<ReminderJob>("reminder",
            j => j.RunAsync(CancellationToken.None), "*/5 * * * *", opts);
        jobs.AddOrUpdate<OrphanMediaCleanupJob>("orphan-media-cleanup",
            j => j.RunAsync(CancellationToken.None), "0 3 * * *", opts);
    }

    // ---------- Pipeline ----------
    app.UseMiddleware<ExceptionHandlingMiddleware>();
    app.UseCors();
    app.UseRateLimiter();
    app.UseAuthentication();
    app.UseAuthorization();

    app.UseSwagger();
    app.UseSwaggerUI();

    // Dashboard Hangfire — chỉ chạy nội bộ: nginx (deploy) không proxy /hangfire ra ngoài.
    app.UseHangfireDashboard("/hangfire");

    app.MapControllers();
    app.MapHub<LiveHub>("/hubs/live");

    app.MapGet("/api/health", () => Results.Ok(new
    {
        status = "ok",
        time = DateTimeOffset.UtcNow.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'")
    })).ExcludeFromDescription();

    await app.RunAsync();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Ứng dụng khởi động thất bại");
    throw;
}
finally
{
    Log.CloseAndFlush();
}

public partial class Program;
