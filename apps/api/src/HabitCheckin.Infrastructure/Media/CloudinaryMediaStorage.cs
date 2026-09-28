using System.Globalization;
using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using HabitCheckin.Application.Abstractions;
using HabitCheckin.Application.Common;
using HabitCheckin.Domain.Entities;
using HabitCheckin.Domain.Enums;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HabitCheckin.Infrastructure.Media;

public sealed class CloudinaryOptions
{
    public const string SectionName = "Cloudinary";
    public string CloudName { get; set; } = string.Empty;
    public string ApiKey { get; set; } = string.Empty;
    public string ApiSecret { get; set; } = string.Empty;
    /// <summary>Upload preset signed cho bằng chứng (ảnh/video).</summary>
    public string ProofPreset { get; set; } = "habit_proof_signed";
    /// <summary>Upload preset signed cho avatar.</summary>
    public string AvatarPreset { get; set; } = "habit_avatar_signed";
    public long MaxImageBytes { get; set; } = 10 * 1024 * 1024;
    public long MaxVideoBytes { get; set; } = 50 * 1024 * 1024;
    /// <summary>Media phải hoàn tất upload trong bao nhiêu phút kể từ intent.</summary>
    public int IntentWindowMinutes { get; set; } = 15;
}

public sealed class CloudinaryMediaStorage(
    IOptions<CloudinaryOptions> options,
    ILogger<CloudinaryMediaStorage> logger) : IMediaStorage
{
    private readonly CloudinaryOptions _opt = options.Value;
    private Cloudinary? _cloudinary;

    private Cloudinary Client => _cloudinary ??= new Cloudinary(new Account(_opt.CloudName, _opt.ApiKey, _opt.ApiSecret));

    public Task<UploadSignature> SignProofAsync(Guid groupId, Guid userId, DateOnly date, ProofType proofType, Guid intentId, CancellationToken ct = default)
    {
        var folder = $"habit/{groupId:N}/{userId:N}/{date:yyyy-MM-dd}";
        var publicId = intentId.ToString("N");
        var allowed = proofType switch
        {
            ProofType.Photo => new List<string> { "image" },
            ProofType.Video => new List<string> { "video" },
            _ => new List<string> { "image", "video" }
        };
        var sig = Sign(folder, publicId, _opt.ProofPreset, allowed);
        return Task.FromResult(sig);
    }

    public Task<UploadSignature> SignAvatarAsync(Guid userId, Guid intentId, CancellationToken ct = default)
    {
        var folder = $"avatars/{userId:N}";
        var publicId = intentId.ToString("N");
        var sig = Sign(folder, publicId, _opt.AvatarPreset, new List<string> { "image" });
        return Task.FromResult(sig);
    }

    private UploadSignature Sign(string folder, string publicId, string preset, List<string> allowedTypes)
    {
        var ts = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var parameters = new SortedDictionary<string, object>
        {
            ["folder"] = folder,
            ["public_id"] = publicId,
            ["timestamp"] = ts,
            ["upload_preset"] = preset
        };
        var signature = Client.Api.SignParameters(parameters);
        return new UploadSignature(_opt.CloudName, _opt.ApiKey, preset, folder, publicId, ts, signature, allowedTypes);
    }

    public async Task<MediaAsset> VerifyAssetAsync(string publicId, ProofType proofType, DateTimeOffset intentAt, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(_opt.CloudName) || _opt.CloudName.StartsWith("REPLACE_", StringComparison.Ordinal))
            throw new InvalidOperationException("Chưa cấu hình Cloudinary");

        GetResourceResult resource;
        try
        {
            resource = await Client.GetResourceAsync(publicId, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Lỗi khi truy vấn Cloudinary asset {PublicId}", publicId);
            throw new BusinessRuleException("Không tìm thấy media đã upload");
        }

        if (resource is null
            || resource.Error is not null
            || resource.StatusCode != System.Net.HttpStatusCode.OK
            || string.IsNullOrWhiteSpace(resource.PublicId))
            throw new BusinessRuleException("Không tìm thấy media đã upload");

        // Đúng loại theo proof_type
        if (proofType == ProofType.Photo && resource.ResourceType != ResourceType.Image)
            throw new BusinessRuleException("Hoạt động này chỉ chấp nhận ảnh");
        if (proofType == ProofType.Video && resource.ResourceType != ResourceType.Video)
            throw new BusinessRuleException("Hoạt động này chỉ chấp nhận video");

        // Dung lượng
        var maxBytes = resource.ResourceType == ResourceType.Image ? _opt.MaxImageBytes : _opt.MaxVideoBytes;
        if (resource.Bytes > maxBytes)
            throw new BusinessRuleException("File vượt quá dung lượng cho phép");

        // Upload phải hoàn tất trong cửa sổ tính từ intent (chống dùng file cũ).
        // CloudinaryDotNet trả CreatedAt là chuỗi KHÔNG có timezone (đã strip 'Z', giữ giờ UTC).
        // Parse bằng CurrentCulture (đúng culture mà thư viện đã format) + AssumeUniversal
        // để giữ đúng khoảnh khắc UTC; AdjustToUniversal ra offset 0 cho Npgsql (timestamptz).
        if (!DateTimeOffset.TryParse(resource.CreatedAt, CultureInfo.CurrentCulture,
                DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var createdAt))
            throw new BusinessRuleException("Media không khớp với thời điểm xin upload, vui lòng thử lại");
        var deadline = intentAt.AddMinutes(_opt.IntentWindowMinutes);
        if (createdAt > deadline)
            throw new BusinessRuleException("Media không khớp với thời điểm xin upload, vui lòng thử lại");

        return new MediaAsset
        {
            PublicId = resource.PublicId,
            ResourceType = resource.ResourceType == ResourceType.Image ? "image" : "video",
            SecureUrl = resource.SecureUrl,
            ThumbnailUrl = resource.ResourceType == ResourceType.Video
                ? resource.SecureUrl + "/so-0.5"
                : resource.SecureUrl,
            Bytes = resource.Bytes,
            UploadedAt = createdAt
        };
    }

    public async Task DeleteAssetAsync(string publicId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(_opt.CloudName) || _opt.CloudName.StartsWith("REPLACE_", StringComparison.Ordinal))
            return;

        try
        {
            await Client.DeleteResourcesAsync(ResourceType.Image, new[] { publicId });
            await Client.DeleteResourcesAsync(ResourceType.Video, new[] { publicId });
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Không xoá được Cloudinary asset {PublicId}", publicId);
        }
    }
}
