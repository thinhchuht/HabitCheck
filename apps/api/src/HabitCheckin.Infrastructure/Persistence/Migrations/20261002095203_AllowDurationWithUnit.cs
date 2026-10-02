using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HabitCheckin.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AllowDurationWithUnit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "chk_activity_type_params",
                table: "activities");

            migrationBuilder.AddCheckConstraint(
                name: "chk_activity_type_params",
                table: "activities",
                sql: "(\"Type\" = 'Deadline' AND \"DeadlineTime\" IS NOT NULL) OR (\"Type\" = 'Duration' AND ((\"TargetMinutes\" IS NOT NULL AND \"TargetMinutes\" > 0) OR \"Unit\" IS NOT NULL)) OR (\"Type\" = 'Window' AND \"WindowStart\" IS NOT NULL AND \"WindowEnd\" IS NOT NULL AND \"WindowEnd\" > \"WindowStart\")");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "chk_activity_type_params",
                table: "activities");

            migrationBuilder.AddCheckConstraint(
                name: "chk_activity_type_params",
                table: "activities",
                sql: "(\"Type\" = 'Deadline' AND \"DeadlineTime\" IS NOT NULL) OR (\"Type\" = 'Duration' AND \"TargetMinutes\" IS NOT NULL AND \"TargetMinutes\" > 0) OR (\"Type\" = 'Window' AND \"WindowStart\" IS NOT NULL AND \"WindowEnd\" IS NOT NULL AND \"WindowEnd\" > \"WindowStart\")");
        }
    }
}
