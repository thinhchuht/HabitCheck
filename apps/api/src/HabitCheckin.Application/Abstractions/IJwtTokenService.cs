using HabitCheckin.Domain.Entities;

namespace HabitCheckin.Application.Abstractions;

public interface IJwtTokenService
{
    int AccessExpiresIn { get; }
    string CreateToken(User user);
}
