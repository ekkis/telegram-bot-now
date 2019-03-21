#!/bin/bash

#
#	Synopsis
#	   This is a small collection of tools to help manage and
#      test `now` deployments
#	Author
#      Erick Calder <e@arix.com>
#	Notes
#      For information on usage please refer to the Medium article:
#      https://medium.com/@ekkis/building-a-telegram-bot-in-node-js-now-6daea82ca425
#

help() {
	cat <<- "EOF"
	mk [command]

	where <command> may be:

	   logs - shows deployment logs for your project
	   msg [-] <command> <chat_id> <from> - sends a message to your server
	   bind - binds your server to the Telegram bot using web hooks
	   bind info - shows binding information
	   bind rm - removes the existing binding
	   clearqueue - useful to wipe out messages stuck in the queue
	   secret <telegram-api-key> - installs your Telegram API key
	   secret <key> <value> - installs other secrets

	To see the actual stattements issued by this script when running
	a command prefix the command with -d:

	   # mk -d bind

	To build a deployment just run this script without arguments:

	   # mk

	-- examples --

	To ping your server:

	   # mk msg "/ping" 2034492 "JohnDoe"

	When running the server locally with `npm start`, you can send messages
	like this:

	   # mk msg - "/ping" 2034492 "JohnDoe"

	To set a secret with credentials for your database:

	   # mk secret "DATABASE_AUTH" "JohnDoe:SomePassword"
	EOF
	exit 0
}

logs() {
	msg="Cannot show logs.  No deployment has been made"
	[ ! -f .url ] && {
		echo $msg; exit 0
	}
	url=$(cat .url)
	[ -z "$url" ] && {
		echo $msg; exit 0
	}
	now logs -f $url
}

msg() {
	cmd=$1; shift
	[ "$cmd" == "-" ] && { srv="-"; cmd=$1; shift; }
	chat_id=$1; shift
	from=$1; shift

	chat=$(printf '"chat": {"id": "%s", "type": "private"}' $chat_id)
	from=$(printf '"from": {"username": "%s"}' $from)
	d=$(printf '{"message": {"text": "%s", %s, %s}}' $cmd "$chat" "$from")
	curl -d "$d" "$(hdr -j)" "$(url $srv)"
	echo ""
}

bind() {
	[ "$1" == "rm" ] && {
		tg deleteWebhook; exit
	}
	[ "$1" == "info" ] && {
		tg getWebhookInfo; exit
	}

	d='{"url": "%s", "allowed_updates": ["message", "channel_post"]}'
	d=$(printf "$d" "$(cat .url)/server.js")
	tg setWebhook -d "'$d'" "$(hdr -j)"
}

clearqueue() {
	tg deleteWebhook
	id=$(tg getUpdates 2>/dev/null |jq .result[-1].update_id)
	id=$(echo "$id+1" |bc)
	tg getUpdates "-F 'offset=$id'"
	bind
}

secret() {
	key=${1:-"telegram-api-key"}
	val=${2:-$1}
	now secret add "$key" "$val"
	[ $? -eq 0 ] && {
		key=$(echo $key| sed 's/-/_/g' |awk '{print toupper($0)}')
		echo "export $key=$val" 
	}
}

example() {
	d=node_modules/telegram-bot-now/examples
	cp $d/server.js . > /dev/null
	cp $d/now.json . > /dev/null
	echo "The following files have been created in your project root:"
	echo " - server.js"
	echo " - now.json"
}

# --- support functionatlity --------------------------------------------------

url() {
	[ $1 == "" ] && {
		echo "$(cat .url)/server.js"
	}
	[ $1 == "-" ] && {
		echo "http://localhost:3000/server.js"
	}
	[ $1 == "-t" ] && {
		echo "https://api.telegram.org/bot${TELEGRAM_API_KEY}"
	}
}

hdr() {
	[[ "$1" == "-j" ]] && {
		echo '-H "Content-Type: application/json"'
	}
}

tg() {
	cmd=$1; shift
	cmd="curl $@ $(url -t)/$cmd"
	[ "$DEBUG" == "Y" ] && {
		echo $cmd
	}
	eval $cmd
	echo ""
}

# --- main() ------------------------------------------------------------------

[ "$1" == "-d" ] && {
	shift; DEBUG=Y; set -x
}
[ "$1" == "--help" ] && {
	help
}
[ -z "$TELEGRAM_API_KEY" ] && {
	echo "Telegram API not set.  Please set the value in your local environment with:"
	echo "export TELEGRAM_API_KEY=xxxxxxxx"
	exit 0
}
[ ! -z "$1" ] && {
	"$@"; exit 0
}

[ -f .url ] && now rm --yes $(cat .url)
now > .url
bind