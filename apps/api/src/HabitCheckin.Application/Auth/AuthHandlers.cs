using FluentValidation;
using HabitCheckin.Application.Abstractions;
using HabitCheckin.Application.Common;
using HabitCheckin.Application.Dtos;
using HabitCheckin.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HabitCheckin.Application.Auth;

// ---------- Google login ----------

public sealed record GoogleLoginCommand(string IdToken) : IRequest<GoogleLoginResult>;

public sealed class GoogleLoginValidator : AbstractValidator<GoogleLoginCommand>
{
    public GoogleLoginValidator() =>
        RuleFor(x => x.IdToken).NotEmpty().WithMessage("Thiếu idToken");
}

public sealed class GoogleLoginHandler(
    IGoogleTokenValidator google,
    IAppDbContext db,
    IClock clock,
    IJwtTokenService jwt) : IRequestHandler<GoogleLoginCommand, GoogleLoginResult>
{
    public async Task<GoogleLoginResult> Handle(GoogleLoginCommand cmd, CancellationToken ct)
    {
        var payload = await google.ValidateAsync(cmd.IdToken, ct)
            ?? throw new UnauthorizedException("Google token không hợp lệ");

        var email = payload.Email.ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(u => u.GoogleSub == payload.Sub, ct);
        if (user is null)
        {
            user = new User
            {
                GoogleSub = payload.Sub,
                Email = email,
                DisplayName = string.IsNullOrWhiteSpace(payload.Name) ? email.Split('@')[0] : payload.Name
            };
            user.CreatedAt = clock.UtcNow;
            db.Users.Add(user);
        }
        user.LastLoginAt = clock.UtcNow;

        var accessToken = jwt.CreateToken(user);
        var refreshToken = TokenHashing.NewRefreshToken();
        db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = TokenHashing.Sha256Hex(refreshToken),
            ExpiresAt = clock.UtcNow.AddDays(30)
        });

        await db.SaveChangesAsync(ct);
        return new GoogleLoginResult(user.ToDto(), accessToken, refreshToken, jwt.AccessExpiresIn);
    }
}

// ---------- Password login (tài khoản admin) ----------

public sealed record PasswordLoginCommand(string Username, string Password) : IRequest<GoogleLoginResult>;

public sealed class PasswordLoginValidator : AbstractValidator<PasswordLoginCommand>
{
    public PasswordLoginValidator()
    {
        RuleFor(x => x.Username).NotEmpty().WithMessage("Thiếu tên đăng nhập");
        RuleFor(x => x.Password).NotEmpty().WithMessage("Thiếu mật khẩu");
    }
}

public sealed class PasswordLoginHandler(IAppDbContext db, IClock clock, IJwtTokenService jwt)
    : IRequestHandler<PasswordLoginCommand, GoogleLoginResult>
{
    public async Task<GoogleLoginResult> Handle(PasswordLoginCommand cmd, CancellationToken ct)
    {
        var username = cmd.Username.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Username == username, ct);

        // Sai thông tin → cùng một thông báo, không tiết lộ tài khoản có tồn tại hay không.
        if (user is null || user.PasswordHash is null
            || !Pbkdf2PasswordHasher.Verify(cmd.Password, user.PasswordHash))
            throw new UnauthorizedException("Tài khoản hoặc mật khẩu không đúng");

        user.LastLoginAt = clock.UtcNow;
        var accessToken = jwt.CreateToken(user);
        var refreshToken = TokenHashing.NewRefreshToken();
        db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = TokenHashing.Sha256Hex(refreshToken),
            ExpiresAt = clock.UtcNow.AddDays(30)
        });

        await db.SaveChangesAsync(ct);
        return new GoogleLoginResult(user.ToDto(), accessToken, refreshToken, jwt.AccessExpiresIn);
    }
}

// ---------- Refresh ----------

public sealed record RefreshTokenCommand(string? RawToken) : IRequest<GoogleLoginResult>;

public sealed class RefreshTokenHandler(IAppDbContext db, IClock clock, IJwtTokenService jwt)
    : IRequestHandler<RefreshTokenCommand, GoogleLoginResult>
{
    public async Task<GoogleLoginResult> Handle(RefreshTokenCommand cmd, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(cmd.RawToken))
            throw new UnauthorizedException("Không có refresh token");

        var hash = TokenHashing.Sha256Hex(cmd.RawToken);
        var rt = await db.RefreshTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.TokenHash == hash, ct)
            ?? throw new UnauthorizedException("Refresh token không hợp lệ");

        if (rt.RevokedAt is not null || rt.ExpiresAt <= clock.UtcNow)
            throw new UnauthorizedException("Refresh token đã hết hạn hoặc bị thu hồi");

        // Rotation
        rt.RevokedAt = clock.UtcNow;
        var newToken = TokenHashing.NewRefreshToken();
        db.RefreshTokens.Add(new RefreshToken
        {
            UserId = rt.UserId,
            TokenHash = TokenHashing.Sha256Hex(newToken),
            ExpiresAt = clock.UtcNow.AddDays(30)
        });
        await db.SaveChangesAsync(ct);

        var user = rt.User!;
        return new GoogleLoginResult(user.ToDto(), jwt.CreateToken(user), newToken, jwt.AccessExpiresIn);
    }
}

// ---------- Logout ----------

public sealed record LogoutCommand(string? RawToken) : IRequest<bool>;

public sealed class LogoutHandler(IAppDbContext db, IClock clock) : IRequestHandler<LogoutCommand, bool>
{
    public async Task<bool> Handle(LogoutCommand cmd, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(cmd.RawToken))
        {
            var hash = TokenHashing.Sha256Hex(cmd.RawToken);
            var rt = await db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash, ct);
            if (rt is not null && rt.RevokedAt is null)
            {
                rt.RevokedAt = clock.UtcNow;
                await db.SaveChangesAsync(ct);
            }
        }
        return true;
    }
}
