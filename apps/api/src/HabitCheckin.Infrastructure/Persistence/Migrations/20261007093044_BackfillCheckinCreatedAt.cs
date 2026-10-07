using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HabitCheckin.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class BackfillCheckinCreatedAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Dòng cũ (handler chưa gán CreatedAt) lưu created_at = 0001-01-01 → UI hiện
            // "01/01 07:06" (năm 0001). Backfill bằng checkin_at (intent_at — sát nhất).
            migrationBuilder.Sql(
                "UPDATE \"checkins\" SET \"CreatedAt\" = \"CheckinAt\" WHERE \"CreatedAt\" < '2000-01-01T00:00:00Z'::timestamptz;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Không reverse được (đã mất giá trị gốc).
        }
    }
}
