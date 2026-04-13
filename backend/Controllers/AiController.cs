using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using LinkedPushApi.Data;
using LinkedPushApi.DTOs;
using LinkedPushApi.Services;

namespace LinkedPushApi.Controllers;

[ApiController]
[Route("api/ai")]
public class AiController : ControllerBase
{
    private const string SystemPrompt = """
        You are a LinkedIn content strategist. Generate engaging LinkedIn posts that:
        - Start with a strong hook (first line grabs attention)
        - Use short paragraphs and line breaks for readability
        - Include relevant hashtags (3-5 at the end)
        - End with a clear call-to-action (question, invitation to comment, etc.)
        - Stay within 3000 characters
        - Sound authentic, not corporate or salesy

        Adjust your tone based on the requested style:
        - Professional: Data-driven, insightful, thought leadership
        - Casual: Conversational, relatable, personal stories
        - Storytelling: Narrative arc, lessons learned, emotional connection
        """;

    private readonly AppDbContext _db;
    private readonly SessionService _session;
    private readonly IConfiguration _config;
    private readonly IHttpClientFactory _httpFactory;

    public AiController(AppDbContext db, SessionService session, IConfiguration config, IHttpClientFactory httpFactory)
    {
        _db = db;
        _session = session;
        _config = config;
        _httpFactory = httpFactory;
    }

    [HttpPost("generate")]
    public async Task<IActionResult> Generate([FromBody] GenerateRequest data)
    {
        await _session.RequireCurrentUser(HttpContext, _db);

        var apiKey = _config["AnthropicApiKey"] ?? "";

        if (string.IsNullOrEmpty(apiKey))
        {
            var templates = new Dictionary<string, string>
            {
                ["professional"] = $"Excited to share insights on {data.Topic}.\n\nHere are 3 key takeaways:\n\n1. Innovation starts with understanding the problem deeply\n2. The best solutions are often the simplest ones\n3. Continuous learning is the competitive advantage\n\nWhat's your experience with {data.Topic}? I'd love to hear your thoughts in the comments.\n\n#LinkedIn #ProfessionalGrowth #Innovation",
                ["casual"] = $"Let me tell you something about {data.Topic} that nobody talks about...\n\nI used to think it was all about the big wins. Turns out, it's the small daily habits that make the real difference.\n\nHere's what changed for me:\n\nI started paying attention to the details. And everything shifted.\n\nAnyone else feel the same way? Drop a comment!\n\n#RealTalk #Growth #CareerTips",
                ["storytelling"] = $"3 years ago, I knew nothing about {data.Topic}.\n\nToday, it's transformed how I work.\n\nHere's the story:\n\nIt started with a simple question from a colleague. That question led me down a rabbit hole I never expected.\n\nThe lesson? Sometimes the most valuable skills come from the most unexpected places.\n\nWhat unexpected skill has changed your career? Share below.\n\n#MyStory #CareerJourney #LessonsLearned",
            };
            var caption = templates.GetValueOrDefault(data.Tone, templates["professional"]);
            return Ok(new GenerateResponse { Caption = caption });
        }

        try
        {
            var userPrompt = $"Write a LinkedIn post about: {data.Topic}";
            if (!string.IsNullOrEmpty(data.AdditionalContext))
                userPrompt += $"\n\nAdditional context: {data.AdditionalContext}";
            userPrompt += $"\n\nTone: {data.Tone}";

            var requestBody = JsonSerializer.Serialize(new
            {
                model = "claude-sonnet-4-5-20250514",
                max_tokens = 1024,
                system = SystemPrompt,
                messages = new[] { new { role = "user", content = userPrompt } }
            });

            var client = _httpFactory.CreateClient();
            client.DefaultRequestHeaders.Add("x-api-key", apiKey);
            client.DefaultRequestHeaders.Add("anthropic-version", "2023-06-01");
            var content = new StringContent(requestBody, Encoding.UTF8, "application/json");
            var resp = await client.PostAsync("https://api.anthropic.com/v1/messages", content);
            resp.EnsureSuccessStatusCode();

            var respJson = await resp.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(respJson);
            var text = doc.RootElement
                .GetProperty("content")[0]
                .GetProperty("text")
                .GetString() ?? "";

            return Ok(new GenerateResponse { Caption = text });
        }
        catch (Exception ex)
        {
            return StatusCode(502, new { detail = $"AI generation failed: {ex.Message[..Math.Min(ex.Message.Length, 200)]}" });
        }
    }
}
