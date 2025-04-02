<?php
define('STORAGE_FILE', 'prices.txt');
define('EMAIL_TO', 'scraper@showeb.net');
define('TIMEOUT_SECS', 30);

$urls = [
   'coles' => 'https://www.coles.com.au/product/optimum-adult-furball-dry-cat-food-with-chicken-2kg-3250864',
   'woolworths' => 'https://www.woolworths.com.au/shop/productdetails/694888'
];

$patterns = [
   'coles' => '/price":\s*"(\d+\.\d+)/',
   'woolworths' => '/price":\s*(\d+\.\d+)/'
];

function fetch_price($url, $pattern) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, TIMEOUT_SECS);
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    $html = curl_exec($ch);

   if($html === false) {
       send_alert("Error: URL unreachable - $url");
       return false;
   }

   if(!preg_match($pattern, $html, $matches)) {
       send_alert("Error: Price pattern changed - $url");
       return false;
   }

   return floatval($matches[1]);
}

function send_alert($msg) {
   global $argv;
   $dry_run = in_array('test', $argv);

   if($dry_run) {
       echo $msg . "\n";
   } else {
       mail(EMAIL_TO, "Price Alert", $msg);
   }
}

function load_prices() {
   if(!file_exists(STORAGE_FILE)) {
       return [];
   }
   $prices = [];
   foreach(file(STORAGE_FILE) as $line) {
       list($site, $price) = explode(",", trim($line));
       $prices[$site] = floatval($price);
   }
   return $prices;
}

function save_prices($prices) {
   $f = fopen(STORAGE_FILE, 'w');
   foreach($prices as $site => $price) {
       fwrite($f, "$site,$price\n");
   }
   fclose($f);
}

$old_prices = load_prices();

foreach($urls as $site => $url) {
   $price = fetch_price($url, $patterns[$site]);
   if($price === false) {
       continue;
   }

   if(!isset($old_prices[$site])) {
       $old_prices[$site] = $price;
       continue;
   }

   if($price != $old_prices[$site]) {
       $diff = $price - $old_prices[$site];
       $direction = $diff > 0 ? "up" : "down";
       send_alert("Price $direction for $site:\nOld: $old_prices[$site]\nNew: $price\nURL: $url");
       $old_prices[$site] = $price;
   }
}

save_prices($old_prices);
