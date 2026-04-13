namespace LinkedPushApi.DTOs;

public class GenerateRequest
{
    public string Topic { get; set; } = "";
    public string Tone { get; set; } = "professional";
    public string? AdditionalContext { get; set; }
}

public class GenerateResponse
{
    public string Caption { get; set; } = "";
}
