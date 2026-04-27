using Microsoft.Extensions.Configuration;

namespace LinkedPushApi.Services;

public static class AppConfig
{
    public static string Get(IConfiguration config, string key, string envKey, string fallback = "")
    {
        var value = config[key];
        if (IsMissingOrPlaceholder(value))
            value = config[envKey];

        return IsMissingOrPlaceholder(value) ? fallback : value!;
    }

    public static bool GetBool(IConfiguration config, string key, string envKey, bool fallback)
    {
        var value = Get(config, key, envKey);
        return string.IsNullOrWhiteSpace(value)
            ? fallback
            : value.Equals("true", StringComparison.OrdinalIgnoreCase);
    }

    public static bool IsMissingOrPlaceholder(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return true;

        var normalized = value.Trim();
        return normalized.Equals("CHANGEME", StringComparison.OrdinalIgnoreCase)
            || normalized.Equals("CHANGE_ME", StringComparison.OrdinalIgnoreCase)
            || normalized.Equals("REPLACE_ME", StringComparison.OrdinalIgnoreCase)
            || normalized.StartsWith("PLACEHOLDER", StringComparison.OrdinalIgnoreCase);
    }

    public static string SmtpHost(IConfiguration config)
        => Get(config, "Smtp:Host", "SMTP_HOST", "");

    public static int SmtpPort(IConfiguration config)
        => int.TryParse(Get(config, "Smtp:Port", "SMTP_PORT", "587"), out var p) ? p : 587;

    public static string SmtpUser(IConfiguration config)
        => Get(config, "Smtp:User", "SMTP_USER", "");

    public static string SmtpPassword(IConfiguration config)
        => Get(config, "Smtp:Password", "SMTP_PASSWORD", "");

    public static string SmtpFrom(IConfiguration config)
        => Get(config, "Smtp:From", "SMTP_FROM", "noreply@linkedpush.com");

    public static bool EmailEnabled(IConfiguration config)
        => GetBool(config, "Email:Enabled", "EMAIL_ENABLED", false);
}
