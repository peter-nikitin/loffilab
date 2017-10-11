<?
require($_SERVER["DOCUMENT_ROOT"]."/bitrix/header.php");
$APPLICATION->SetTitle("test");
?><?$APPLICATION->IncludeComponent(
	"bitrix:search.form",
	"mainnav-search",
	Array(
		"PAGE" => "#SITE_DIR#search/index.php",
		"USE_SUGGEST" => "N"
	)
);?><?$APPLICATION->IncludeComponent(
	"bitrix:main.pagenavigation", 
	"modern", 
	array(
		"COMPONENT_TEMPLATE" => "modern"
	),
	false
);?><?require($_SERVER["DOCUMENT_ROOT"]."/bitrix/footer.php");?>