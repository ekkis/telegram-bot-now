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

	To see the actual statements issued by this script when running
	a command prefix the command with -d:

	   $ mk -d bind

	To build a deployment just run this script without arguments:

	   $ mk

	-- messaging --

	For development you can run your bot using `npm start`.  You can send
	messages to it from the command line like this:

		$ mk msg -l "/ping" 2034492 "JohnDoe"	# local
	
	After deployment (hosted on Now) you can message the bot with `-b`:
	
		$ mk msg -b "/ping" 2034492 "JohnDoe"	# deployed

	You can also message Telegram directly.  Hers's how:

		$ mk msg -t "/ping" 2034492 "JohnDoe"	# Telegram

	and for testing the sending of images, supply a valid file id via the
	environment variable shown, and pass the -p parameter:

		$ export TELEGRAM_BOT_IMAGE="AgADAQADaqgxGyX5yETF2DyyOFrdN_9sDDAABO6I-45utcxCSBoEAAEC"
		$ mk msg -b "/ping" 2034492 "JohnDoe" -p

	-- examples --

	To show current bindings:

		$ mk bind info

	To set a secret with credentials for your database:

	   $ mk secret "DATABASE_AUTH" "JohnDoe:SomePassword"
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
	now logs -n ${1:-200} -f $url
}

msg() {
	srv=$1; cmd=$2; chat_id=$3; from=$4; type=$5; args=$6
	[ "$type" == "-p" -a "$TELEGRAM_BOT_IMAGE" == "" ] && {
		echo "No Telegram bot image ID available"
		exit 1
	}

	d=$(msg_data $srv $chat_id $from "$cmd" $type "$args")
	if [ "$srv" == "-t" ]; then
		[ "$type" == "-p" ] && method="sendPhoto" || method="sendMessage"
		fetch $method $srv -d "'$d'" $(hdr -j)
	else
		fetch $srv -d "'$d'" $(hdr -j)
	fi
}

bind() {
	[ "$1" == "rm" ] && {
		fetch deleteWebhook -t; exit
	}
	[ "$1" == "info" ] && {
		fetch getWebhookInfo -t; exit
	}

	d='{"url": "%s", "allowed_updates": ["message", "channel_post"]}'
	d=$(printf "'$d'" "$(cat .url)/server.js")
	fetch setWebhook -t -d "$d" $(hdr -j)
}

clearqueue() {
	fetch deleteWebhook
	id=$(fetch getUpdates -t 2>/dev/null |jq .result[-1].update_id)
	id=$(echo "$id+1" |bc)
	fetch getUpdates -t "-F 'offset=$id'"
	bind
}

secret() {
	key=$1; val=$2
	(( $# == 1 )) && {
		key="telegram-api-key"; val=$1
	}   
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
	[ "$1" == "-b" ] && {
		echo "$(cat .url)/server.js"
	}
	[ "$1" == "-l" ] && {
		echo "http://localhost:3000/server.js"
	}
	[ "$1" == "-t" ] && {
		echo "https://api.telegram.org/bot${TELEGRAM_API_KEY}"
	}
}

hdr() {
	[[ "$1" == "-j" ]] && {
		echo -H "Content-Type:application/json"
	}
}

fetch() {
	srv=$1; cmd=""; shift
	[[ "$srv" != -* ]] && {
		cmd=$srv; srv=$1; shift
	}
	cmd="curl $@ $(url $srv)/$cmd"
	[ "$DEBUG" == "Y" ] && {
		echo $cmd
	}
	eval $cmd
	echo ""
}

msg_data() {
	srv=$1; chat_id=$2; from=$3; cmd=$4; type=$5; args=$6
	
	if [ "$type" == "-p" ]
	then
		if [ "$srv" == "-t" ]; then
			printf "$(msg_photoToTel)" $chat_id
		else
			printf "$(msg_photoToBot)" $chat_id $from
		fi
	elif [ "$type" == "-k" ]
	then
		printf "$(msg_keyboardToTel)" $chat_id "$args"
	else
		f=$([ "$srv" == "-t" ] && msg_textToTel || msg_textToBot)
		printf "$f" $chat_id $from "$cmd"
	fi
}

msg_textToTel() {
    cat <<- EOF
	{
		"chat_id": "%s",
		"chat_type": "private",
		"username": "%s",
		"parse_mode": "Markdown",
		"text": "%s"
	}
	EOF
}

msg_textToBot() {
	cat <<- EOF
	{ "message": {
		"chat": {"id": "%s", "type": "private"},
		"from": {"username": "%s"},
		"text": "%s"
	}}
	EOF
}

msg_photoToTel() {
	cat <<- EOF 
	{   
		"chat_id": "%s",
		"photo": "$TELEGRAM_BOT_IMAGE"
	}   
	EOF
}

msg_photoToBot() {
	cat <<- EOF 
	{ "message": {  
		"chat": {
			"id": "%s",
			"type": "private"
		},
		"from": {"username": "%s"},
		"photo": [{
			"file_id": "$TELEGRAM_BOT_IMAGE",
			"file_size": "857",
			"width": "90", 
			"height": "15"
		}]
	}}
	EOF
}

msg_keyboardToTel() {
	cat <<- EOF
	{
		"chat_id": "%s",
		"text": "xx",
		"reply_markup": {
			"keyboard": [%s],
			"one_time_keyboard": true,
			"resize_keyboard": true,
			"selective": false
		}
	}
	EOF
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
