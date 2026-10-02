using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using HabitCheckin.Application.Abstractions;
using HabitCheckin.Domain.Entities;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace HabitCheckin.Infrastructure.Auth;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";
    public string Secret { get; set; } = string.Empty;
    // 7 ngày — đủ "vĩnh viễn" để user không bao giờ thấy 401 trong khi dùng;
    // refresh cookie (365 ngày) là lớp dự phòng nếu token hết hạn giữa chừng.
    public int AccessMinutes { get; set; } = 10080;
    public string Issuer { get; set; } = "habit-checkin";
    public string Audience { get; set; } = "habit-checkin-web";
}

public sealed class JwtTokenService(IOptions<JwtOptions> options) : IJwtTokenService
{
    private readonly JwtOptions _opt = options.Value;

    public int AccessExpiresIn => _opt.AccessMinutes;

    public string CreateToken(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_opt.Secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new(JwtRegisteredClaimNames.Name, user.DisplayName)
        };
        if (user.IsAdmin)
            claims.Add(new Claim(ClaimTypes.Role, "admin"));

        var token = new JwtSecurityToken(
            issuer: _opt.Issuer,
            audience: _opt.Audience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: DateTime.UtcNow.AddMinutes(_opt.AccessMinutes),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
