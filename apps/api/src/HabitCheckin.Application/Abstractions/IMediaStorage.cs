using HabitCheckin.Domain.Entities;
using HabitCheckin.Domain.Enums;

namespace HabitCheckin.Application.Abstractions;

public sealed record UploadSignature(
    string CloudName,
    string ApiKey,
    string UploadPreset,
    string Folder,
    string PublicId,
    long Timestamp,
    string Signature,
    List<string> AllowedTypes);

public interface IMediaStorage
{
    /// <summary>Ký upload cho bằng chứng check-in (folder habit/{group}/{user}/{date}).</summary>
    Task<UploadSignature> SignProofAsync(Guid groupId, Guid userId, DateOnly date, ProofType proofType, Guid intentId, CancellationToken ct = default);

    /// <summary>Ký upload avatar (folder avatars/{userId}).</summary>
    Task<UploadSignature> SignAvatarAsync(Guid userId, Guid intentId, CancellationToken ct = default);

    /// <summary>
    /// Xác minh asset đã upload bằng Admin API: tồn tại, đúng loại theo proofType,
    /// dung lượng trong giới hạn, created_at ≤ intentAt + 15 phút.
    /// Trả về MediaAsset chưa được add vào DB (handler tự lưu).
    /// </summary>
    Task<MediaAsset> VerifyAssetAsync(string publicId, ProofType proofType, DateTimeOffset intentAt, CancellationToken ct = default);

    Task DeleteAssetAsync(string publicId, CancellationToken ct = default);
}
