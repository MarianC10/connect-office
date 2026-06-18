package main

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"text/tabwriter"
	"time"
)

func printErr(err error) {
	fmt.Fprintf(os.Stderr, "error: %v\n", err)
}

func formatTime(iso string) string {
	t, err := time.Parse(time.RFC3339, iso)
	if err != nil {
		return iso
	}
	return t.Local().Format("15:04")
}

func printMe(p meProfile) {
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintf(w, "ID\t%s\n", p.ID)
	fmt.Fprintf(w, "Email\t%s\n", p.Email)
	fmt.Fprintf(w, "Display name\t%s\n", p.DisplayName)
	fmt.Fprintf(w, "Public\t%v\n", p.IsPublic)
	w.Flush()
}

func printProfiles(title string, profiles []publicProfile) {
	if len(profiles) == 0 {
		fmt.Println("none")
		return
	}
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	if title != "" {
		fmt.Println(title)
	}
	fmt.Fprintf(w, "ID\tDISPLAY NAME\tPUBLIC\n")
	for _, p := range profiles {
		fmt.Fprintf(w, "%s\t%s\t%v\n", p.ID, p.DisplayName, p.IsPublic)
	}
	w.Flush()
}

func printProfile(p publicProfile, email string) {
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintf(w, "ID\t%s\n", p.ID)
	if email != "" {
		fmt.Fprintf(w, "Email\t%s\n", email)
	}
	fmt.Fprintf(w, "Display name\t%s\n", p.DisplayName)
	fmt.Fprintf(w, "Public\t%v\n", p.IsPublic)
	w.Flush()
}

func printFriends(friends []friend) {
	if len(friends) == 0 {
		fmt.Println("no friends")
		return
	}
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintf(w, "ID\tDISPLAY NAME\tPUBLIC\n")
	for _, f := range friends {
		fmt.Fprintf(w, "%s\t%s\t%v\n", f.ID, f.DisplayName, f.IsPublic)
	}
	w.Flush()
}

func printInbox(items []friendRequest) {
	if len(items) == 0 {
		fmt.Println("inbox empty")
		return
	}
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintf(w, "EMAIL\tDISPLAY NAME\tREQUEST ID\tSINCE\n")
	for _, r := range items {
		email := strings.TrimSpace(r.FromEmail)
		if email == "" {
			email = "(unknown — use display name: accept \"" + r.DisplayName + "\")"
		}
		fmt.Fprintf(w, "%s\t%s\t%s\t%s\n", email, r.DisplayName, r.ID, formatTime(r.CreatedAt))
	}
	w.Flush()
	fmt.Println("\nUse: accept <email> | accept \"Display Name\"")
}

func printConversations(items []conversation) {
	if len(items) == 0 {
		fmt.Println("no conversations")
		return
	}
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintf(w, "FRIEND\tCONVERSATION ID\tLAST MESSAGE\n")
	for _, c := range items {
		preview := ""
		if c.LastMessage != nil {
			preview = c.LastMessage.Body
		}
		fmt.Fprintf(w, "%s\t%s\t%s\n", c.Friend.DisplayName, c.ID, preview)
	}
	w.Flush()
}

func printMessageLine(label, iso, body string) {
	fmt.Printf("[%s] %s: %s\n", formatTime(iso), label, body)
}

func printHistory(messages []chatMessage, myUserID, peerName string) {
	if len(messages) == 0 {
		fmt.Println("--- no messages yet ---")
		return
	}
	fmt.Println("--- history ---")
	for i := len(messages) - 1; i >= 0; i-- {
		m := messages[i]
		label := peerName
		if m.SenderID == myUserID {
			label = "You"
		}
		printMessageLine(label, m.CreatedAt, m.Body)
	}
	fmt.Println("--- live ---")
}

func printJSON(v any) {
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	_ = enc.Encode(v)
}

func usage() {
	help := `social-cli — act as the seed test user for social API testing

Usage:
  go run ./cmd/social-cli [global flags] <command> [args]

Global flags:
  --api URL          API base (default http://localhost:8080, env SOCIAL_CLI_API_BASE_URL)
  --token JWT        Use existing token instead of minting
  --user-id UUID     Mint token for a different user (advanced)

Commands:
  me                              Show current identity
  profile [--public|--private] [--name "X"]
  search <query>                  Search public users by name
  lookup <email>                  Profile by exact email
  friends                         List friends
  inbox                           Pending friend requests
  request <email>                 Send friend request
  accept <email>                  Accept request from email
  decline <email>                 Decline request from email
  conversations                   List chats
  send <email> <message>          Send one message
  chat <email> [--history N]        Interactive chat (REST history + WS live)
  help                            Show this help

Examples:
  go run ./cmd/social-cli inbox
  go run ./cmd/social-cli accept alice@example.com
  go run ./cmd/social-cli chat alice@example.com
`
	fmt.Print(help)
}

func parseBoolFlag(args []string, name string) (bool, []string) {
	out := make([]string, 0, len(args))
	found := false
	for _, a := range args {
		if a == name {
			found = true
			continue
		}
		out = append(out, a)
	}
	return found, out
}

func parseStringFlag(args []string, name string) (string, []string) {
	out := make([]string, 0, len(args))
	var val string
	for i := 0; i < len(args); i++ {
		if args[i] == name && i+1 < len(args) {
			val = args[i+1]
			i++
			continue
		}
		if strings.HasPrefix(args[i], name+"=") {
			val = strings.TrimPrefix(args[i], name+"=")
			continue
		}
		out = append(out, args[i])
	}
	return val, out
}

func parseIntFlag(args []string, name string, defaultVal int) (int, []string) {
	s, rest := parseStringFlag(args, name)
	if s == "" {
		return defaultVal, rest
	}
	var n int
	if _, err := fmt.Sscanf(s, "%d", &n); err != nil || n <= 0 {
		return defaultVal, rest
	}
	return n, rest
}
