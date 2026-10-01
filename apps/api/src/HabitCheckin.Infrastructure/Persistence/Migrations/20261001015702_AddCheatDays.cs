using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HabitCheckin.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCheatDays : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsCheatDay",
                table: "daily_results",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "cheat_days",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    GroupId = table.Column<Guid>(type: "uuid", nullable: false),
                    LocalDate = table.Column<DateOnly>(type: "date", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_cheat_days", x => x.Id);
                    table.ForeignKey(
                        name: "FK_cheat_days_groups_GroupId",
                        column: x => x.GroupId,
                        principalTable: "groups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_cheat_days_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_cheat_days_GroupId",
                table: "cheat_days",
                column: "GroupId");

            migrationBuilder.CreateIndex(
                name: "IX_cheat_days_UserId_GroupId_LocalDate",
                table: "cheat_days",
                columns: new[] { "UserId", "GroupId", "LocalDate" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "cheat_days");

            migrationBuilder.DropColumn(
                name: "IsCheatDay",
                table: "daily_results");
        }
    }
}
