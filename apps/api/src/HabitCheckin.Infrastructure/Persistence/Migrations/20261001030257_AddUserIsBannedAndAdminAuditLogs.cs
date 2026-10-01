using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HabitCheckin.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddUserIsBannedAndAdminAuditLogs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsBanned",
                table: "users",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "admin_audit_logs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AdminId = table.Column<Guid>(type: "uuid", nullable: false),
                    Action = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    TargetType = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    TargetId = table.Column<Guid>(type: "uuid", nullable: true),
                    Detail = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_admin_audit_logs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_admin_audit_logs_users_AdminId",
                        column: x => x.AdminId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_admin_audit_logs_AdminId",
                table: "admin_audit_logs",
                column: "AdminId");

            migrationBuilder.CreateIndex(
                name: "IX_admin_audit_logs_CreatedAt",
                table: "admin_audit_logs",
                column: "CreatedAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "admin_audit_logs");

            migrationBuilder.DropColumn(
                name: "IsBanned",
                table: "users");
        }
    }
}
