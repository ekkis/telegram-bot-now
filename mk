#!/bin/bash

#
#	Synopsis
#		This is a small collection of tools to help manage and test `now` deployments
#	Author
#		Erick Calder <e@arix.com>
#	Notes
#		For information on usage please refer to the Medium article:
#		https://medium.com/@ekkis/building-a-telegram-bot-in-node-js-now-6daea82ca425
#

logs() {
	now logs -f $(cat .url)
}

url() {
	host=${1/-/http://localhost:3000}
	echo "${host:-$(cat .url)}/index.js"
}

get() {
	curl "$(url $1)/?name=ekkis&id=3"
	echo ""
}
	
post_url() {
	curl -d 's=ekkis&id=3' $(url $1)
	echo ""
}

post() {
	s='{"message": {"text": "%s", "chat": {"id": "1"}}}'
	s=$(printf "$s" ${1:-ekkis})
	curl -v -d "$s" -H "Content-Type: application/json" $(url $2)
	echo ""
}

reply() {
	key=$(cat .env |sed 's/.*=//')
	url="https://api.telegram.org/bot${key}/sendMessage";
	s='{"chat_id": "%d", "text": "wow"}'
	s=$(printf "$s" $1)
	curl -v -d "$s" -H "Content-Type: application/json" $url
	echo ""
}

bind() {
	[ "$1" == "rm" ] && {
		tsend deleteWebhook
		exit
	}
	[ "$1" == "info" ] && {
		tsend getWebhookInfo
		exit
	}

	key=$(cat .env |sed 's/.*=//')
	url="$(cat .url)/server.js"
	webhook="https://api.telegram.org/bot${key}/setWebhook"
	js='{"url": "%s", "allowed_updates": ['message', 'channel_post']}';
	curl -d "$(printf "$js" $url)" -H "Content-Type: application/json" $webhook
	echo ""
}

tsend() {
	cmd="curl"
	key=$(cat .env |sed 's/.*=//')
	[ ! -z "$2" ] && {
		cmd="$cmd -F $2"
	}
	cmd="$cmd https://api.telegram.org/bot${key}/$1"
	$cmd
	echo ""
}

clearqueue() {
	tsend deleteWebhook
	id=$(tsend getUpdates |jq .result[0].update_id)
	tsend getUpdates offset=$id
	bind
}

secret() {
	now secret add telegram-api-key "$1"
}

	
[ "$1" == "-d" ] && {
	shift
	set -x
}
[ ! -z "$1" ] && {
	$@
	exit 0
}

now
url=$(pbpaste)
echo $url > .url
bind
