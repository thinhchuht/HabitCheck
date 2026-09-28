using System.Security.Claims;
using HabitCheckin.Application.Abstractions;
using HabitCheckin.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace HabitCheckin.Api.Authorization;

/// <summary>
/// Quyền nhóm theo route {groupId}, chủ challenge theo route {challengeId}.
/// Controller bắt buộc đặt tên route param đúng như vậy.
/// </summary>

// ---------- GroupMember ----------

public sealed class GroupMemberRequirement : IAuthorizationRequirement;

public sealed class GroupMemberHandler(IAppDbContext db) : AuthorizationHandler<GroupMemberRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context, GroupMemberRequirement requirement) =>
        CheckGroupRoleAsync(context, requirement, role => true);

    internal async Task CheckGroupRoleAsync(
        AuthorizationHandlerContext context, IAuthorizationRequirement requirement, Func<MemberRole, bool> roleOk)
    {
        var http = context.Resource as HttpContext;
        if (http is null)
        {
            context.Fail();
            return;
        }

        var userIdStr = http.User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? http.User.FindFirstValue("sub");
        if (!Guid.TryParse(userIdStr, out var userId))
        {
            context.Fail();
            return;
        }

        if (!Guid.TryParse(http.Request.RouteValues["groupId"] as string, out var groupId))
        {
            context.Fail();
            return;
        }

        var member = await db.GroupMembers.AsNoTracking()
            .FirstOrDefaultAsync(m => m.GroupId == groupId && m.UserId == userId, http.RequestAborted);
        if (member is null || !roleOk(member.Role))
        {
            context.Fail();
            return;
        }

        context.Succeed(requirement);
    }
}

// ---------- GroupAdmin / GroupOwner ----------

public sealed class GroupAdminRequirement : IAuthorizationRequirement;

public sealed class GroupAdminHandler(IAppDbContext db) : AuthorizationHandler<GroupAdminRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context, GroupAdminRequirement requirement) =>
        new GroupMemberHandler(db).CheckGroupRoleAsync(context, requirement,
            r => r is MemberRole.Owner or MemberRole.Admin);
}

public sealed class GroupOwnerRequirement : IAuthorizationRequirement;

public sealed class GroupOwnerHandler(IAppDbContext db) : AuthorizationHandler<GroupOwnerRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context, GroupOwnerRequirement requirement) =>
        new GroupMemberHandler(db).CheckGroupRoleAsync(context, requirement,
            r => r == MemberRole.Owner);
}

// ---------- ChallengeOwner ----------

public sealed class ChallengeOwnerRequirement : IAuthorizationRequirement;

public sealed class ChallengeOwnerHandler(IAppDbContext db) : AuthorizationHandler<ChallengeOwnerRequirement>
{
    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context, ChallengeOwnerRequirement requirement)
    {
        var http = context.Resource as HttpContext;
        if (http is null)
        {
            context.Fail();
            return;
        }

        var userIdStr = http.User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? http.User.FindFirstValue("sub");
        if (!Guid.TryParse(userIdStr, out var userId))
        {
            context.Fail();
            return;
        }

        if (!Guid.TryParse(http.Request.RouteValues["challengeId"] as string, out var challengeId))
        {
            context.Fail();
            return;
        }

        var ownerId = await db.Challenges.AsNoTracking()
            .Where(c => c.Id == challengeId)
            .Select(c => (Guid?)c.UserId)
            .FirstOrDefaultAsync(http.RequestAborted);

        if (ownerId != userId)
        {
            context.Fail();
            return;
        }

        context.Succeed(requirement);
    }
}
