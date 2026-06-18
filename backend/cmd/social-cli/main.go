package main

import (
	"fmt"
	"os"
	"strings"
)

type cliConfig struct {
	apiBase string
	token   string
	userID  string
	jsonOut bool
}

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(1)
	}

	cfg, args := parseGlobalFlags(os.Args[1:])
	if len(args) == 0 {
		usage()
		os.Exit(1)
	}

	cmd := args[0]
	cmdArgs := args[1:]

	if cmd == "help" || cmd == "-h" || cmd == "--help" {
		usage()
		return
	}

	token, err := resolveToken(cfg.token, cfg.userID)
	if err != nil {
		printErr(err)
		os.Exit(1)
	}

	client := newAPIClient(cfg.apiBase, token)

	if err := runCommand(client, token, cfg, cmd, cmdArgs); err != nil {
		printErr(err)
		os.Exit(1)
	}
}

func parseGlobalFlags(args []string) (cliConfig, []string) {
	cfg := cliConfig{apiBase: apiBaseFromEnv()}
	rest := make([]string, 0, len(args))
	for i := 0; i < len(args); i++ {
		switch args[i] {
		case "--api":
			if i+1 < len(args) {
				cfg.apiBase = args[i+1]
				i++
			}
		case "--token":
			if i+1 < len(args) {
				cfg.token = args[i+1]
				i++
			}
		case "--user-id":
			if i+1 < len(args) {
				cfg.userID = args[i+1]
				i++
			}
		case "--json":
			cfg.jsonOut = true
		default:
			rest = append(rest, args[i])
		}
	}
	return cfg, rest
}

func runCommand(c *apiClient, token string, cfg cliConfig, cmd string, args []string) error {
	switch cmd {
	case "me":
		p, err := c.getMe()
		if err != nil {
			return err
		}
		if cfg.jsonOut {
			printJSON(p)
		} else {
			printMe(p)
		}
		return nil

	case "profile":
		return runProfile(c, cfg, args)

	case "search":
		if len(args) < 1 {
			return fmt.Errorf("usage: search <query>")
		}
		q := strings.Join(args, " ")
		items, err := c.searchUsers(q)
		if err != nil {
			return err
		}
		if cfg.jsonOut {
			printJSON(items)
		} else {
			printProfiles("", items)
		}
		return nil

	case "lookup":
		if len(args) < 1 {
			return fmt.Errorf("usage: lookup <email>")
		}
		p, err := c.resolveEmail(args[0])
		if err != nil {
			return err
		}
		if cfg.jsonOut {
			printJSON(p)
		} else {
			printProfile(p, args[0])
		}
		return nil

	case "friends":
		items, err := c.listFriends()
		if err != nil {
			return err
		}
		if cfg.jsonOut {
			printJSON(items)
		} else {
			printFriends(items)
		}
		return nil

	case "inbox":
		items, err := c.listInbox()
		if err != nil {
			return err
		}
		if cfg.jsonOut {
			printJSON(items)
		} else {
			printInbox(items)
		}
		return nil

	case "request":
		if len(args) < 1 {
			return fmt.Errorf("usage: request <email>")
		}
		return c.sendFriendRequest(args[0])

	case "accept":
		if len(args) < 1 {
			return fmt.Errorf("usage: accept <email>")
		}
		req, err := c.findInboxRequestFromEmail(args[0])
		if err != nil {
			return err
		}
		if err := c.acceptRequest(req.ID); err != nil {
			return err
		}
		fmt.Printf("accepted friend request from %s\n", args[0])
		return nil

	case "decline":
		if len(args) < 1 {
			return fmt.Errorf("usage: decline <email>")
		}
		req, err := c.findInboxRequestFromEmail(args[0])
		if err != nil {
			return err
		}
		if err := c.declineRequest(req.ID); err != nil {
			return err
		}
		fmt.Printf("declined friend request from %s\n", args[0])
		return nil

	case "conversations":
		items, err := c.listConversations()
		if err != nil {
			return err
		}
		if cfg.jsonOut {
			printJSON(items)
		} else {
			printConversations(items)
		}
		return nil

	case "send":
		if len(args) < 2 {
			return fmt.Errorf("usage: send <email> <message>")
		}
		email := args[0]
		body := strings.Join(args[1:], " ")
		profile, err := c.resolveEmail(email)
		if err != nil {
			return err
		}
		ok, err := c.isFriend(profile.ID)
		if err != nil {
			return err
		}
		if !ok {
			return fmt.Errorf("%s is not a friend", email)
		}
		conv, err := c.conversationWithFriend(profile.ID)
		if err != nil {
			return err
		}
		msg, err := c.sendMessage(conv.ID, body)
		if err != nil {
			return err
		}
		if cfg.jsonOut {
			printJSON(msg)
		} else {
			fmt.Printf("sent to %s: %s\n", profile.DisplayName, msg.Body)
		}
		return nil

	case "chat":
		if len(args) < 1 {
			return fmt.Errorf("usage: chat <email> [--history N]")
		}
		email := args[0]
		historyLimit, _ := parseIntFlag(args[1:], "--history", 50)
		return runChatSession(c, token, email, historyLimit)

	default:
		return fmt.Errorf("unknown command %q (try help)", cmd)
	}
}

func runProfile(c *apiClient, cfg cliConfig, args []string) error {
	public, args := parseBoolFlag(args, "--public")
	private, args := parseBoolFlag(args, "--private")
	name, args := parseStringFlag(args, "--name")
	if public && private {
		return fmt.Errorf("use --public or --private, not both")
	}
	if len(args) > 0 {
		return fmt.Errorf("unexpected arguments: %v", args)
	}

	var displayName *string
	var isPublic *bool
	if name != "" {
		displayName = &name
	}
	if public {
		v := true
		isPublic = &v
	}
	if private {
		v := false
		isPublic = &v
	}
	if displayName == nil && isPublic == nil {
		return fmt.Errorf("usage: profile [--public|--private] [--name \"X\"]")
	}

	p, err := c.patchMe(displayName, isPublic)
	if err != nil {
		return err
	}
	if cfg.jsonOut {
		printJSON(p)
	} else {
		printMe(p)
	}
	return nil
}
