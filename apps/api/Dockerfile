# ---- Build stage ----
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Restore trước để cache layer
COPY ["HabitCheckin.sln", "."]
COPY ["src/HabitCheckin.Domain/HabitCheckin.Domain.csproj", "src/HabitCheckin.Domain/"]
COPY ["src/HabitCheckin.Application/HabitCheckin.Application.csproj", "src/HabitCheckin.Application/"]
COPY ["src/HabitCheckin.Infrastructure/HabitCheckin.Infrastructure.csproj", "src/HabitCheckin.Infrastructure/"]
COPY ["src/HabitCheckin.Api/HabitCheckin.Api.csproj", "src/HabitCheckin.Api/"]
RUN dotnet restore HabitCheckin.sln

COPY . .
RUN dotnet publish src/HabitCheckin.Api/HabitCheckin.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

# ---- Runtime stage ----
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:8080
ENV TZ=Asia/Ho_Chi_Minh
EXPOSE 8080

ENTRYPOINT ["dotnet", "HabitCheckin.Api.dll"]
