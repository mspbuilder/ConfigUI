<%@ Control Language="C#" EnableViewState="true" AutoEventWireup="true" ClassName="ConfigLauncher.ascx" Inherits="System.Web.UI.UserControl" %>
<%@ Import Namespace="System" %>
<%@ Import Namespace="System.Web" %>
<%@ Import Namespace="System.Security.Cryptography" %>
<%@ Import Namespace="System.Text" %>
<%@ Import Namespace="mojoPortal.Business" %>
<%@ Import Namespace="mojoPortal.Business.WebHelpers" %>
<%@ Import Namespace="mojoPortal.Web.Framework" %>

<script runat="server">
    protected string vueAppUrl = ConfigurationManager.AppSettings["VueAppUrl"] ?? "http://localhost:5173";
    protected string jwtSecret = ConfigurationManager.AppSettings["JwtSecret"] ?? "your-secret-key-change-this";
    protected string launchUrl = string.Empty;
    
    protected void Page_Load(object sender, EventArgs e)
    {
        if (!Page.IsPostBack)
        {
            GenerateLaunchUrl();
        }
    }
    
    protected void GenerateLaunchUrl()
    {
        SiteUser currentUser = SiteUtils.GetCurrentSiteUser();
        
        if (currentUser == null)
        {
            Response.Redirect("~/Secure/Login.aspx?returnurl=" + Server.UrlEncode(Request.RawUrl));
            return;
        }
        
        // Generate JWT token (no external libraries needed)
        string token = GenerateJwt(currentUser);
        
        // Build launch URL with token
        launchUrl = $"{vueAppUrl}/?token={Server.UrlEncode(token)}";
    }
    
    protected string GenerateJwt(SiteUser user)
    {
        // JWT Header
        string header = "{\"alg\":\"HS256\",\"typ\":\"JWT\"}";
        
        // JWT Payload
        long unixTime = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        long expTime = unixTime + (4 * 60 * 60); // 4 hours
        
        string payload = $"{{\"userId\":{user.UserId},\"username\":\"{EscapeJson(user.LoginName)}\",\"email\":\"{EscapeJson(user.Email)}\",\"displayName\":\"{EscapeJson(user.Name)}\",\"iat\":{unixTime},\"exp\":{expTime}}}";
        
        // Base64Url encode
        string encodedHeader = Base64UrlEncode(Encoding.UTF8.GetBytes(header));
        string encodedPayload = Base64UrlEncode(Encoding.UTF8.GetBytes(payload));
        
        // Create signature using HMAC-SHA256
        string signature = CreateHmacSha256Signature(encodedHeader + "." + encodedPayload, jwtSecret);
        
        return encodedHeader + "." + encodedPayload + "." + signature;
    }
    
    protected string CreateHmacSha256Signature(string data, string secret)
    {
        using (HMACSHA256 hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret)))
        {
            byte[] hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(data));
            return Base64UrlEncode(hash);
        }
    }
    
    protected string Base64UrlEncode(byte[] input)
    {
        string base64 = Convert.ToBase64String(input);
        // Convert to URL-safe Base64
        return base64.Replace('+', '-').Replace('/', '_').TrimEnd('=');
    }
    
    protected string EscapeJson(string text)
    {
        if (string.IsNullOrEmpty(text))
            return "";
        
        return text.Replace("\\", "\\\\")
                   .Replace("\"", "\\\"")
                   .Replace("\n", "\\n")
                   .Replace("\r", "\\r")
                   .Replace("\t", "\\t");
    }
    
    protected void btnLaunch_Click(object sender, EventArgs e)
    {
        GenerateLaunchUrl();
        
        // Register script to open in new tab
        string script = $@"
            <script type='text/javascript'>
                window.open('{launchUrl}', '_blank');
            </script>
        ";
        
        ClientScript.RegisterStartupScript(this.GetType(), "LaunchVueApp", script);
    }
</script>

<style type="text/css">
.config-launcher-panel {
    background: white;
    padding: 2rem;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    max-width: 600px;
    margin: 2rem auto;
    text-align: center;
}

.config-launcher-panel h2 {
    color: #0a5591;
    margin-bottom: 1rem;
}

.config-launcher-panel p {
    margin-bottom: 1.5rem;
    color: #666;
}

.launch-button {
    background: linear-gradient(#0dccea, #0d70ea);
    color: white;
    border: none;
    border-radius: 4px;
    padding: 1rem 2rem;
    font-size: 1.1rem;
    font-weight: bold;
    cursor: pointer;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
    transition: opacity 0.2s;
}

.launch-button:hover {
    opacity: 0.9;
}

.info-text {
    margin-top: 1.5rem;
    font-size: 0.9rem;
    color: #999;
}
</style>

<div class="config-launcher-panel">
    <h2>Configuration Manager</h2>
    <p>Launch the new Configuration Manager application in a separate tab.</p>
    
    <asp:Button 
        runat="server" 
        ID="btnLaunch" 
        Text="Launch Configuration Manager" 
        CssClass="launch-button"
        OnClick="btnLaunch_Click" />
    
    <p class="info-text">
        The application will open in a new browser tab.<br/>
        Your authentication is automatically handled.
    </p>
</div>
