using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HabitCheckin.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Trigger so khớp trạng thái không phân biệt hoa/thường: EF lưu 'Draft' (PascalCase),
    /// nhưng dữ liệu sửa tay bằng SQL có thể là 'DRAFT' — cả hai đều phải cho phép sửa hoạt động.
    /// </summary>
    public partial class FixActivityLockTriggerCaseInsensitive : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                "CREATE OR REPLACE FUNCTION prevent_activity_change_when_locked() RETURNS trigger AS $$ " +
                "DECLARE s text; " +
                "BEGIN " +
                "  SELECT \"Status\" INTO s FROM challenges " +
                "   WHERE \"Id\" = COALESCE(NEW.\"ChallengeId\", OLD.\"ChallengeId\"); " +
                "  IF s IS NOT NULL AND UPPER(s) <> 'DRAFT' THEN " +
                "    RAISE EXCEPTION 'Challenge is locked, activities cannot be modified'; " +
                "  END IF; " +
                "  RETURN COALESCE(NEW, OLD); " +
                "END $$ LANGUAGE plpgsql;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                "CREATE OR REPLACE FUNCTION prevent_activity_change_when_locked() RETURNS trigger AS $$ " +
                "DECLARE s text; " +
                "BEGIN " +
                "  SELECT \"Status\" INTO s FROM challenges " +
                "   WHERE \"Id\" = COALESCE(NEW.\"ChallengeId\", OLD.\"ChallengeId\"); " +
                "  IF s <> 'Draft' THEN " +
                "    RAISE EXCEPTION 'Challenge is locked, activities cannot be modified'; " +
                "  END IF; " +
                "  RETURN COALESCE(NEW, OLD); " +
                "END $$ LANGUAGE plpgsql;");
        }
    }
}
