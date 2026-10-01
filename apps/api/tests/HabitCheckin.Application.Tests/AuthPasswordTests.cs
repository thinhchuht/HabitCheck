using FluentAssertions;
using HabitCheckin.Application.Abstractions;
using HabitCheckin.Application.Auth;
using HabitCheckin.Application.Common;
using HabitCheckin.Domain.Entities;
using HabitCheckin.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HabitCheckin.Application.Tests;

public class Pbkdf2PasswordHasherTests
{
    [Fact]
    public void Hash_Verify_Roundtrip()
    {
        var hash = Pbkdf2PasswordHasher.Hash("admin@thinhchu");

        hash.Should().StartWith("PBKDF2-SHA256$");
        Pbkdf2PasswordHasher.Verify("admin@thinhchu", hash).Should().BeTrue();
    }

    [Fact]
    public void Hash_TwoHashesOfSamePassword_Differ()
    {
        Pbkdf2PasswordHasher.Hash("abc").Should().NotBe(Pbkdf2PasswordHasher.Hash("abc"));
    }

    [Fact]
    public void Verify_WrongPassword_ReturnsFalse()
    {
        var hash = Pbkdf2PasswordHasher.Hash("admin@thinhchu");

        Pbkdf2PasswordHasher.Verify("admin@thinhchu1", hash).Should().BeFalse();
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-a-hash")]
    [InlineData("PBKDF2-SHA1$210000$CQ/+IFZm3t0h6hc2sUTyYg==$ud1x72LHvYVsKkWMYUbp7tMFvRPic6cnURwbFOkaLWs=")]
    [InlineData("PBKDF2-SHA256$210000$CQ/+IFZm3t0h6hc2sUTyYg==")]
    [InlineData("PBKDF2-SHA256$0$CQ/+IFZm3t0h6hc2sUTyYg==$ud1x72LHvYVsKkWMYUbp7tMFvRPic6cnURwbFOkaLWs=")]
    public void Verify_MalformedHash_ReturnsFalse(string stored)
    {
        Pbkdf2PasswordHasher.Verify("admin@thinhchu", stored).Should().BeFalse();
    }
}

public class PasswordLoginHandlerTests
{
    // 01:00 UTC = 08:00 giờ VN
    private static readonly DateTimeOffset Now = new(2025, 1, 15, 1, 0, 0, TimeSpan.Zero);

    private sealed class FakeJwt : IJwtTokenService
    {
        public int AccessExpiresIn => 900;
        public string CreateToken(User user) => $"token-{user.Id:N}";
    }

    private static async Task<AppDbContext> NewDbAsync(string? username = null, string? password = null)
    {
        var db = DbFactory.New();
        db.Users.Add(new User
        {
            GoogleSub = username is null ? "g-1" : $"local:{username}",
            Email = username is null ? "google@example.com" : $"{username}@local",
            DisplayName = username is null ? "Google User" : "Admin",
            Username = username,
            PasswordHash = password is null ? null : Pbkdf2PasswordHasher.Hash(password),
            IsAdmin = username is not null,
            CreatedAt = Now
        });
        await db.SaveChangesAsync();
        return db;
    }

    private static PasswordLoginHandler NewHandler(AppDbContext db) =>
        new(db, new FakeClock(Now), new FakeJwt());

    [Fact]
    public async Task ValidCredentials_ReturnsTokensAndUpdatesLastLogin()
    {
        var db = await NewDbAsync("thinhchuht", "admin@thinhchu");
        var handler = NewHandler(db);

        var result = await handler.Handle(
            new PasswordLoginCommand("THINHCHUHT", "admin@thinhchu"), default);

        result.AccessToken.Should().StartWith("token-");
        result.User.IsAdmin.Should().BeTrue();
        result.RefreshTokenValue.Should().NotBeNullOrWhiteSpace();
        (await db.RefreshTokens.CountAsync()).Should().Be(1);

        var user = await db.Users.SingleAsync();
        user.LastLoginAt.Should().Be(Now);
    }

    [Fact]
    public async Task WrongPassword_ThrowsUnauthorized()
    {
        var db = await NewDbAsync("thinhchuht", "admin@thinhchu");
        var handler = NewHandler(db);

        var act = () => handler.Handle(
            new PasswordLoginCommand("thinhchuht", "sai-pass"), default);

        await act.Should().ThrowAsync<UnauthorizedException>();
        (await db.RefreshTokens.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task UnknownUser_ThrowsUnauthorized()
    {
        var db = await NewDbAsync("thinhchuht", "admin@thinhchu");
        var handler = NewHandler(db);

        var act = () => handler.Handle(
            new PasswordLoginCommand("người-lạ", "admin@thinhchu"), default);

        await act.Should().ThrowAsync<UnauthorizedException>();
    }

    [Fact]
    public async Task GoogleUserWithoutPassword_ThrowsUnauthorized()
    {
        var db = await NewDbAsync(); // user Google: Username = null
        var handler = NewHandler(db);

        var act = () => handler.Handle(
            new PasswordLoginCommand("google@example.com", "x"), default);

        // User không có username → không thể login bằng mật khẩu.
        await act.Should().ThrowAsync<UnauthorizedException>();
        (await db.RefreshTokens.CountAsync()).Should().Be(0);
    }
}
