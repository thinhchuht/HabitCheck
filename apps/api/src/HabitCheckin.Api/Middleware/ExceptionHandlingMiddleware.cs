using System.Linq;
using System.Text.Json;
using HabitCheckin.Application.Common;
using Microsoft.AspNetCore.Mvc;
using ProblemDetails = Microsoft.AspNetCore.Mvc.ProblemDetails;

namespace HabitCheckin.Api.Middleware;

/// <summary>
/// Chuyển exception nghiệp vụ thành RFC 7807 ProblemDetails với mã lỗi + thông báo tiếng Việt.
/// </summary>
public sealed class ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (Exception ex)
        {
            await HandleAsync(context, ex);
        }
    }

    private async Task HandleAsync(HttpContext context, Exception ex)
    {
        if (context.Response.HasStarted)
        {
            logger.LogError("Response đã bắt đầu, không gửi được lỗi cho {Path}", context.Request.Path);
            return;
        }

        // RFC 7807: Title = loại lỗi chung, Detail = thông báo cụ thể của lần này.
        // Frontend hiển thị theo thứ tự: errors (field) -> detail -> title.
        (int Status, string Title, string? Detail, IDictionary<string, object?>? Errors) result = ex switch
        {
            ValidationException vex => (StatusCodes.Status400BadRequest, "Dữ liệu không hợp lệ", null,
                ToProblemDict(vex.Errors)),
            UnauthorizedException ux => (StatusCodes.Status401Unauthorized, "Chưa đăng nhập hoặc không có quyền", ux.Message, null),
            UnauthorizedAccessException => (StatusCodes.Status401Unauthorized, "Chưa đăng nhập hoặc phiên đã hết hạn", null, null),
            ConflictException cx => (StatusCodes.Status409Conflict, "Xung đột dữ liệu", cx.Message, null),
            NotFoundException nf => (StatusCodes.Status404NotFound, "Không tìm thấy dữ liệu", nf.Message, null),
            BusinessRuleException bx => (StatusCodes.Status422UnprocessableEntity, "Vi phạm quy tắc nghiệp vụ", bx.Message, null),
            _ => (StatusCodes.Status500InternalServerError, "Có lỗi xảy ra, vui lòng thử lại sau", null, null)
        };
        var (Status, Title, Detail, Errors) = result;

        if (ex is not (ValidationException or UnauthorizedException or ConflictException or NotFoundException or BusinessRuleException))
            logger.LogError(ex, "Lỗi không xử lý: {Path}", context.Request.Path);

        var problem = new ProblemDetails
        {
            Status = Status,
            Title = Title,
            Detail = Detail,
            Type = $"https://habit-checkin.local/errors/{ex switch
            {
                ValidationException => "validation",
                NotFoundException => "not-found",
                ConflictException => "conflict",
                UnauthorizedException or UnauthorizedAccessException => "unauthorized",
                BusinessRuleException => "business-rule",
                _ => "internal"
            }}"
        };

        if (Errors is not null)
            problem.Extensions["errors"] = Errors;

        static IDictionary<string, object?> ToProblemDict(IReadOnlyDictionary<string, string[]> errors)
        {
            var dict = new Dictionary<string, object?>(errors.Count);
            foreach (var (key, value) in errors)
                dict[key] = value;
            return dict;
        }

        context.Response.StatusCode = Status;
        context.Response.ContentType = "application/problem+json";
        await context.Response.WriteAsync(
            JsonSerializer.Serialize(problem, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
            }));
    }
}
