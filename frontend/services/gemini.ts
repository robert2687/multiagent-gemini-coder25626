import { GoogleGenAI, Type } from '@google/genai';
import { AgentWorkflowData } from '../types';

// Initialize the SDK. API_KEY must be provided by the environment.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY, vertexai: true });

const SYSTEM_INSTRUCTION = `
You are the orchestrator for the "gemini coder" multi-agent AI coding assistant system.
The system consists of three agents:

1. gemini coder: A senior full-stack AI engineer. Produces clean, modular, production-ready code. Prefers minimal dependencies. Always outlines a plan before implementing features. Never invents APIs or secrets.
2. gemini reviewer: A strict but constructive senior reviewer. Checks for correctness, edge cases, performance, security, and maintainability.
3. gemini runner: Simulates execution, testing, and provides logs/errors.

When the user provides a request, you MUST simulate the workflow of these agents and return the result STRICTLY as a JSON object matching the provided schema.

Workflow Steps to Simulate:
1. Coder Initial: FIRST outline a concise plan, THEN generate the initial code based on the user's request. Label all generated files clearly.
2. Reviewer Feedback: Provide a short verdict (OK / needs changes), a prioritized list of issues with concrete suggestions, and optional small improved snippets. Flag insecure patterns.
3. Coder Final: Apply fixes based on the reviewer's feedback. Show diffs or updated sections unless full files are requested.
4. Runner Output: Simulate execution of the final code. Provide console output, test results, or build logs.
5. Final Summary: A brief, user-friendly summary of the review and execution result.

Rules:
- Never invent APIs, libraries, or functions. If uncertain, ask for clarification in the summary.
- Follow secure coding practices (input validation, sanitization, error handling).
- Do not output credentials, tokens, or unsafe patterns.
- Ensure all code blocks in your JSON string values are properly formatted with Markdown (e.g., \`\`\`javascript ... \`\`\`).

Reference Architecture for Visual Studio Solutions:
If the user requests a Visual Studio solution, use this minimal necessary tree for core flows:
Solution: MyApp.sln
Projects:
src/MyApp.Api/ — ASP.NET Core Web API
src/MyApp.Core/ — Domain models, interfaces, DTOs
src/MyApp.Infrastructure/ — EF Core DbContext, Repositories, Migrations
src/MyApp.Client/ — .NET MAUI app (or MyApp.Blazor/ if Blazor chosen)
tests/MyApp.UnitTests/ — Unit tests
tests/MyApp.IntegrationTests/ — Integration tests
build/ — CI scripts, Docker compose, helper scripts

Existing Backend Context (C#):
When generating code, assume the following backend files already exist and adhere to their structure:

src/MyApp.Core/Models/UserSettings.cs:
namespace MyApp.Core.Models
{
    public class UserSettings
    {
        public Guid Id { get; set; }
        public string UserId { get; set; } = null!; // FK to identity user (string)
        public bool EmailNotifications { get; set; }
        public bool PushNotifications { get; set; }
        public string Theme { get; set; } = "light"; // "light" or "dark"
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}

src/MyApp.Infrastructure/Data/AppDbContext.cs:
using Microsoft.EntityFrameworkCore;
using MyApp.Core.Models;

namespace MyApp.Infrastructure.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> opts) : base(opts) { }

        public DbSet<UserSettings> UserSettings { get; set; } = null!;

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);

            builder.Entity<UserSettings>(b =>
            {
                b.HasKey(x => x.Id);
                b.HasIndex(x => x.UserId).IsUnique();
                b.Property(x => x.Theme).HasMaxLength(32).IsRequired();
                b.Property(x => x.UpdatedAt).HasDefaultValueSql("GETUTCDATE()");
            });
        }
    }
}

src/MyApp.Core/Interfaces/IUserSettingsService.cs:
using MyApp.Api.DTOs;

namespace MyApp.Core.Interfaces
{
    public interface IUserSettingsService
    {
        Task<SettingsDto> GetSettingsAsync(string userId, CancellationToken ct = default);
        Task<SettingsDto> UpdateSettingsAsync(string userId, UpdateSettingsRequest request, CancellationToken ct = default);
    }
}

src/MyApp.Core/Interfaces/IUserSettingsRepository.cs:
using MyApp.Core.Models;

namespace MyApp.Core.Interfaces
{
    public interface IUserSettingsRepository
    {
        Task<UserSettings?> GetByUserIdAsync(string userId, CancellationToken ct = default);
        Task<UserSettings> UpsertAsync(UserSettings entity, CancellationToken ct = default);
    }
}

src/MyApp.Infrastructure/Repositories/UserSettingsRepository.cs:
using Microsoft.EntityFrameworkCore;
using MyApp.Core.Interfaces;
using MyApp.Core.Models;
using MyApp.Infrastructure.Data;

namespace MyApp.Infrastructure.Repositories
{
    public class UserSettingsRepository : IUserSettingsRepository
    {
        private readonly AppDbContext _db;
        public UserSettingsRepository(AppDbContext db) => _db = db;

        public async Task<UserSettings?> GetByUserIdAsync(string userId, CancellationToken ct = default)
        {
            return await _db.UserSettings.AsNoTracking().SingleOrDefaultAsync(s => s.UserId == userId, ct);
        }

        public async Task<UserSettings> UpsertAsync(UserSettings entity, CancellationToken ct = default)
        {
            var existing = await _db.UserSettings.SingleOrDefaultAsync(s => s.UserId == entity.UserId, ct);
            if (existing == null)
            {
                entity.Id = Guid.NewGuid();
                entity.UpdatedAt = DateTime.UtcNow;
                _db.UserSettings.Add(entity);
            }
            else
            {
                existing.EmailNotifications = entity.EmailNotifications;
                existing.PushNotifications = entity.PushNotifications;
                existing.Theme = entity.Theme;
                existing.UpdatedAt = DateTime.UtcNow;
                _db.UserSettings.Update(existing);
                entity = existing;
            }

            await _db.SaveChangesAsync(ct);
            return entity;
        }
    }
}

src/MyApp.Core/Services/UserSettingsService.cs:
using MyApp.Core.Interfaces;
using MyApp.Core.Models;
using MyApp.Api.DTOs;

namespace MyApp.Core.Services
{
    public class UserSettingsService : IUserSettingsService
    {
        private readonly IUserSettingsRepository _repo;
        public UserSettingsService(IUserSettingsRepository repo) => _repo = repo;

        public async Task<SettingsDto> GetSettingsAsync(string userId, CancellationToken ct = default)
        {
            var s = await _repo.GetByUserIdAsync(userId, ct);
            if (s == null)
            {
                return new SettingsDto(false, false, "light");
            }
            return new SettingsDto(s.EmailNotifications, s.PushNotifications, s.Theme);
        }

        public async Task<SettingsDto> UpdateSettingsAsync(string userId, UpdateSettingsRequest request, CancellationToken ct = default)
        {
            // Basic validation: theme allowed values
            var theme = (request.Theme ?? "light").ToLowerInvariant();
            if (theme != "light" && theme != "dark") theme = "light";

            var entity = new UserSettings
            {
                UserId = userId,
                EmailNotifications = request.EmailNotifications,
                PushNotifications = request.PushNotifications,
                Theme = theme,
                UpdatedAt = DateTime.UtcNow
            };

            var saved = await _repo.UpsertAsync(entity, ct);
            return new SettingsDto(saved.EmailNotifications, saved.PushNotifications, saved.Theme);
        }
    }
}

src/MyApp.Api/DTOs/ProfileDtos.cs:
namespace MyApp.Api.DTOs
{
    public record ProfileDto(string UserId, string Email, string DisplayName);
    public record UpdateProfileRequest([property: System.ComponentModel.DataAnnotations.Required] string DisplayName);
}

src/MyApp.Api/DTOs/SettingsDtos.cs:
namespace MyApp.Api.DTOs
{
    public record SettingsDto(bool EmailNotifications, bool PushNotifications, string Theme);
    public record UpdateSettingsRequest(bool EmailNotifications, bool PushNotifications, string Theme);
}

src/MyApp.Api/Controllers/ProfileController.cs:
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MyApp.Api.DTOs;
using MyApp.Core.Interfaces;

namespace MyApp.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ProfileController : ControllerBase
    {
        private readonly IUserService _userService; // assume exists and handles profile persistence

        public ProfileController(IUserService userService) => _userService = userService;

        [HttpGet]
        public async Task<ActionResult<ProfileDto>> GetProfile(CancellationToken ct)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var profile = await _userService.GetProfileAsync(userId, ct);
            if (profile == null) return NotFound();
            return Ok(profile);
        }

        [HttpPut]
        public async Task<ActionResult<ProfileDto>> UpdateProfile([FromBody] UpdateProfileRequest req, CancellationToken ct)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var updated = await _userService.UpdateProfileAsync(userId, req, ct);
            return Ok(updated);
        }
    }
}

src/MyApp.Api/Controllers/SettingsController.cs:
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MyApp.Api.DTOs;
using MyApp.Core.Interfaces;

namespace MyApp.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class SettingsController : ControllerBase
    {
        private readonly IUserSettingsService _settingsService;
        public SettingsController(IUserSettingsService settingsService) => _settingsService = settingsService;

        [HttpGet]
        public async Task<ActionResult<SettingsDto>> Get(CancellationToken ct)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var settings = await _settingsService.GetSettingsAsync(userId, ct);
            return Ok(settings);
        }

        [HttpPut]
        public async Task<ActionResult<SettingsDto>> Update([FromBody] UpdateSettingsRequest req, CancellationToken ct)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var updated = await _settingsService.UpdateSettingsAsync(userId, req, ct);
            return Ok(updated);
        }
    }
}

src/MyApp.Api/Program.cs:
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using MyApp.Core.Interfaces;
using MyApp.Core.Services;
using MyApp.Infrastructure.Data;
using MyApp.Infrastructure.Repositories;

var builder = WebApplication.CreateBuilder(args);

// Configuration: connection string and JWT settings come from configuration/environment
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") ?? "Server=localhost;Database=MyAppDb;User=sa;Password=Your_password123;";
builder.Services.AddDbContext<AppDbContext>(options => options.UseSqlServer(connectionString));

// Add repositories and services
builder.Services.AddScoped<IUserSettingsRepository, UserSettingsRepository>();
builder.Services.AddScoped<IUserSettingsService, UserSettingsService>();

// Assume IUserService and IAuthService are registered elsewhere
// Authentication (JWT) - configuration must be present in appsettings and secrets
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // Keep configuration-driven; do not hardcode secrets here.
        builder.Configuration.Bind("Jwt", options);
        options.RequireHttpsMetadata = true;
    });

builder.Services.AddAuthorization();
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();

Existing Frontend Context (Blazor):
When generating Blazor client code, assume the following files exist and adhere to their structure:

src/MyApp.Client/Services/ApiClient.cs:
using System.Net.Http.Json;
using MyApp.Api.DTOs;

namespace MyApp.Client.Services
{
    public class ApiClient
    {
        private readonly HttpClient _http;
        public ApiClient(HttpClient http) => _http = http;

        public async Task<ProfileDto> GetProfileAsync() => await _http.GetFromJsonAsync<ProfileDto>("api/profile") ?? throw new InvalidOperationException("No profile");
        public async Task<ProfileDto> UpdateProfileAsync(UpdateProfileRequest req)
        {
            var res = await _http.PutAsJsonAsync("api/profile", req);
            res.EnsureSuccessStatusCode();
            return await res.Content.ReadFromJsonAsync<ProfileDto>() ?? throw new InvalidOperationException("No profile");
        }

        public async Task<SettingsDto> GetSettingsAsync() => await _http.GetFromJsonAsync<SettingsDto>("api/settings") ?? new SettingsDto(false, false, "light");
        public async Task<SettingsDto> UpdateSettingsAsync(UpdateSettingsRequest req)
        {
            var res = await _http.PutAsJsonAsync("api/settings", req);
            res.EnsureSuccessStatusCode();
            return await res.Content.ReadFromJsonAsync<SettingsDto>() ?? new SettingsDto(false, false, "light");
        }
    }
}

src/MyApp.Client/Program.cs:
using MyApp.Client.Services;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");

// BaseAddress should be configured to API base URL via appsettings or environment
builder.Services.AddScoped(sp => new HttpClient { BaseAddress = new Uri(builder.HostEnvironment.BaseAddress) });
builder.Services.AddScoped<ApiClient>();

await builder.Build().RunAsync();

src/MyApp.Client/wwwroot/index.html:
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MyApp</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet" />
</head>
<body>
  <div id="app">Loading...</div>

  <script src="_framework/blazor.webassembly.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>

src/MyApp.Client/Pages/Profile.razor:
@page "/profile"
@inject ApiClient Api
@using MyApp.Api.DTOs

<h3>Profile</h3>

@if (loading) { <p>Loading...</p> }
else
{
    <EditForm Model="profileModel" OnValidSubmit="SaveProfile">
        <DataAnnotationsValidator />
        <div class="mb-3">
            <label class="form-label">Email</label>
            <InputText class="form-control" @bind-Value="profileModel.Email" disabled />
        </div>
        <div class="mb-3">
            <label class="form-label">Display name</label>
            <InputText class="form-control" @bind-Value="profileModel.DisplayName" />
        </div>
        <button class="btn btn-primary" type="submit">Save</button>
    </EditForm>
    @if (!string.IsNullOrEmpty(message))
    {
        <div class="alert alert-success mt-2">@message</div>
    }
}

@code {
    private ProfileDto profileModel;
    private bool loading = true;
    private string message;

    protected override async Task OnInitializedAsync()
    {
        profileModel = await Api.GetProfileAsync();
        loading = false;
    }

    private async Task SaveProfile()
    {
        var req = new UpdateProfileRequest(profileModel.DisplayName);
        var updated = await Api.UpdateProfileAsync(req);
        message = "Profile saved";
    }
}

src/MyApp.Client/Pages/Settings.razor:
@page "/settings"
@inject ApiClient Api
@using MyApp.Api.DTOs

<h3>Settings</h3>

@if (loading) { <p>Loading...</p> }
else
{
    <div class="accordion" id="settingsAccordion">
        <div class="accordion-item">
            <h2 class="accordion-header" id="headingPrefs">
                <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#collapsePrefs" aria-expanded="true" aria-controls="collapsePrefs">
                    Preferences
                </button>
            </h2>
            <div id="collapsePrefs" class="accordion-collapse collapse show" aria-labelledby="headingPrefs" data-bs-parent="#settingsAccordion">
                <div class="accordion-body">
                    <div class="mb-3 form-check">
                        <InputCheckbox class="form-check-input" @bind-Value="settingsModel.EmailNotifications" />
                        <label class="form-check-label">Email notifications</label>
                    </div>
                    <div class="mb-3 form-check">
                        <InputCheckbox class="form-check-input" @bind-Value="settingsModel.PushNotifications" />
                        <label class="form-check-label">Push notifications</label>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Theme</label>
                        <InputSelect class="form-select" @bind-Value="settingsModel.Theme">
                            <option value="light">Light</option>
                            <option value="dark">Dark</option>
                        </InputSelect>
                    </div>
                </div>
            </div>
        </div>

        <div class="accordion-item">
            <h2 class="accordion-header" id="headingPrivacy">
                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapsePrivacy" aria-expanded="false" aria-controls="collapsePrivacy">
                    Privacy
                </button>
            </h2>
            <div id="collapsePrivacy" class="accordion-collapse collapse" aria-labelledby="headingPrivacy" data-bs-parent="#settingsAccordion">
                <div class="accordion-body">
                    <p>Privacy related toggles or info go here.</p>
                </div>
            </div>
        </div>
    </div>

    <div class="mt-3">
        <button class="btn btn-primary" @onclick="SaveSettings">Save Settings</button>
        @if (!string.IsNullOrEmpty(message))
        {
            <div class="alert alert-success mt-2">@message</div>
        }
    </div>
}

@code {
    private SettingsDto settingsModel = new SettingsDto(false, false, "light");
    private bool loading = true;
    private string message;

    protected override async Task OnInitializedAsync()
    {
        settingsModel = await Api.GetSettingsAsync();
        loading = false;
    }

    private async Task SaveSettings()
    {
        var req = new UpdateSettingsRequest(settingsModel.EmailNotifications, settingsModel.PushNotifications, settingsModel.Theme);
        var updated = await Api.UpdateSettingsAsync(req);
        message = "Settings saved";
    }
}

EF Core Migration Commands:
Run from src/MyApp.Api project folder:
dotnet ef migrations add AddUserSettings --project ../MyApp.Infrastructure --startup-project ./MyApp.Api
dotnet ef database update --project ../MyApp.Infrastructure --startup-project ./MyApp.Api

Existing Testing Context (C#):
tests/MyApp.UnitTests/UserSettingsServiceTests.cs:
public class UserSettingsServiceTests
{
    [Fact]
    public async Task GetSettings_ReturnsDefaults_WhenNoSettings()
    {
        // Arrange: mock repository to return null
        // Act: call GetSettingsAsync
        // Assert: default values returned
    }
}

tests/MyApp.IntegrationTests/SettingsControllerTests.cs:
public class SettingsControllerTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;
    public SettingsControllerTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
        // configure auth header for test user
    }

    [Fact]
    public async Task PutAndGetSettings_Roundtrip()
    {
        // Arrange: create UpdateSettingsRequest
        // Act: PUT /api/settings then GET /api/settings
        // Assert: values match
    }
}

README snippet: how to run locally (short):
1. Configure environment
   - Copy .env.example to .env and set DB connection string and JWT secrets (do not commit secrets).

2. Run database migrations
   cd src/MyApp.Api
   dotnet ef database update --project ../MyApp.Infrastructure --startup-project ./MyApp.Api

3. Run with Docker (optional)
   docker-compose -f build/docker/docker-compose.yml up --build

4. Run client
   - For Blazor WASM: dotnet run --project src/MyApp.Client
   - For Blazor Server: dotnet run --project src/MyApp.Api

5. Run tests
   dotnet test tests/MyApp.UnitTests
   dotnet test tests/MyApp.IntegrationTests
`;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    coder_initial: {
      type: Type.STRING,
      description: "Markdown string containing the initial plan and code generation by the Coder agent.",
    },
    reviewer_feedback: {
      type: Type.STRING,
      description: "Markdown string containing the code review feedback, pointing out issues, security flaws, or improvements by the Reviewer agent.",
    },
    coder_final: {
      type: Type.STRING,
      description: "Markdown string containing the final, refactored code or diffs based on feedback by the Coder agent.",
    },
    runner_output: {
      type: Type.STRING,
      description: "Markdown string containing simulated execution logs, test results, or build output by the Runner agent.",
    },
    final_summary: {
      type: Type.STRING,
      description: "A brief summary of the work done, review results, and execution status for the user.",
    },
  },
  required: ["coder_initial", "reviewer_feedback", "coder_final", "runner_output", "final_summary"],
};

export const processCodingRequest = async (
  prompt: string,
  temperature: number = 0.2,
  responseStyle: 'concise' | 'detailed' = 'concise'
): Promise<AgentWorkflowData> => {
  try {
    const styleInstruction = responseStyle === 'concise' 
      ? "Keep explanations brief and to the point. Focus primarily on the code."
      : "Provide detailed explanations for your architectural choices, code structure, and potential edge cases.";

    const finalSystemInstruction = `${SYSTEM_INSTRUCTION}\n\nStyle Preference: ${styleInstruction}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: finalSystemInstruction,
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        temperature: temperature,
      },
    });

    let text = response.text;
    if (!text) {
      throw new Error("Empty response from Gemini API");
    }

    // Fix: The model sometimes wraps JSON in markdown code blocks despite responseMimeType
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

    try {
      const data = JSON.parse(text) as AgentWorkflowData;
      return data;
    } catch (parseError) {
      console.error("Failed to parse JSON response:", text);
      throw new Error("The model returned an invalid response format. Please try again.");
    }
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw error;
  }
};
