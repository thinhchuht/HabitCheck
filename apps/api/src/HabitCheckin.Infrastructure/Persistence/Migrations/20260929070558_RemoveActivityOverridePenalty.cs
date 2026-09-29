using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HabitCheckin.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RemoveActivityOverridePenalty : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "OverridePenalty",
                table: "activities");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "OverridePenalty",
                table: "activities",
                type: "bigint",
                nullable: true);
        }
    }
}
