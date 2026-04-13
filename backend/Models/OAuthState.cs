using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LinkedPushApi.Models;

[Table("oauth_states")]
public class OAuthState
{
    [Key]
    [Column("state")]
    [MaxLength(128)]
    public string State { get; set; } = "";

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("cli_port")]
    public int? CliPort { get; set; }
}
